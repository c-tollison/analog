import {
    and,
    asc,
    eq,
    inArray,
    isNull,
    ne,
    notInArray,
    schema,
    sql,
} from '@analog/db';
import type { SeriesChoiceSchema } from '@analog/types';

import {
    createItemClaimingIsbn,
    findBookByIsbn,
    findOrCreateBook,
    isbnFacts,
    kindInSeries,
    type Lookup,
    lookupBook,
    refreshSeriesCover,
    saveLater,
    seriesForItem,
    type Transaction,
} from './books.js';
import { db } from './init.js';
import { HTTPException } from 'hono/http-exception';
import type { z } from 'zod';

// Moving ISBNs between catalog items: a scan joining a volume that already
// exists, adding an edition by hand, and an admin merging two items or
// splitting an ISBN off into its own.

type CatalogItem = typeof schema.catalogItem.$inferSelect;
type SeriesChoice = z.output<typeof SeriesChoiceSchema>;

// The item already at this volume in a series, preferring a verified one.
async function findVolume(
    seriesId: string,
    volume: number,
    otherThan: string
): Promise<CatalogItem | null> {
    const { catalogItem } = schema;
    const [found] = await db()
        .select()
        .from(catalogItem)
        .where(
            and(
                eq(catalogItem.seriesId, seriesId),
                eq(catalogItem.position, volume),
                ne(catalogItem.id, otherThan)
            )
        )
        .orderBy(
            sql`${catalogItem.verifiedAt} asc nulls last`,
            asc(catalogItem.createdAt)
        )
        .limit(1);
    return found ?? null;
}

/**
 * Moves everything on one item onto another for the same volume: its ISBNs,
 * collection entries and progress. A collection that has both keeps one
 * entry, owning every edition, and a person with progress on both keeps the
 * other item's. Deletes the first item.
 */
async function moveItemInto(
    tx: Transaction,
    fromId: string,
    intoId: string,
    { pending }: { pending: boolean }
): Promise<void> {
    const {
        catalogItem,
        catalogItemIsbn,
        collectionItem,
        collectionItemIsbn,
        progress,
    } = schema;
    const entryColumns = {
        id: collectionItem.id,
        collectionId: collectionItem.collectionId,
    };
    const [fromEntries, intoEntries] = await Promise.all([
        tx
            .select(entryColumns)
            .from(collectionItem)
            .where(eq(collectionItem.catalogItemId, fromId)),
        tx
            .select(entryColumns)
            .from(collectionItem)
            .where(eq(collectionItem.catalogItemId, intoId)),
    ]);
    for (const entry of fromEntries) {
        const kept = intoEntries.find(
            (other) => other.collectionId === entry.collectionId
        );
        if (kept) {
            await tx
                .update(collectionItemIsbn)
                .set({ collectionItemId: kept.id })
                .where(eq(collectionItemIsbn.collectionItemId, entry.id));
        }
    }
    await tx
        .update(collectionItem)
        .set({ catalogItemId: intoId, updatedAt: new Date() })
        .where(
            and(
                eq(collectionItem.catalogItemId, fromId),
                notInArray(
                    collectionItem.collectionId,
                    intoEntries.map((entry) => entry.collectionId)
                )
            )
        );

    const people = await tx
        .select({ id: progress.userId })
        .from(progress)
        .where(eq(progress.catalogItemId, intoId));
    await tx
        .update(progress)
        .set({ catalogItemId: intoId, updatedAt: new Date() })
        .where(
            and(
                eq(progress.catalogItemId, fromId),
                notInArray(
                    progress.userId,
                    people.map((row) => row.id)
                )
            )
        );

    await tx
        .update(catalogItemIsbn)
        .set({ catalogItemId: intoId, main: false, pending })
        .where(eq(catalogItemIsbn.catalogItemId, fromId));
    await tx.delete(catalogItem).where(eq(catalogItem.id, fromId));
}

/**
 * Moves a scanned book onto another item for the same volume. Its ISBN waits
 * on an admin there. Only an item with no series that isn't verified can
 * join, and false means someone else placed it first.
 */
async function joinItem(fromId: string, intoId: string): Promise<boolean> {
    const { catalogItem } = schema;
    return db().transaction(async (tx) => {
        // Locks the row, so a scan placing it at the same time waits.
        const [joinable] = await tx
            .update(catalogItem)
            .set({ updatedAt: new Date() })
            .where(
                and(
                    eq(catalogItem.id, fromId),
                    isNull(catalogItem.seriesId),
                    isNull(catalogItem.verifiedAt)
                )
            )
            .returning({ id: catalogItem.id });
        if (!joinable) {
            return false;
        }
        await moveItemInto(tx, fromId, intoId, { pending: true });
        return true;
    });
}

/**
 * Merges an item into another for the same book, for when two scans made
 * separate items. The other item keeps its own details, series and volume,
 * and takes this one's series when it has none. Its ISBNs count as checked,
 * since an admin matched them.
 */
export async function mergeItem(fromId: string, intoId: string): Promise<void> {
    if (fromId === intoId) {
        throw new HTTPException(400, {
            message: "An item can't be merged into itself",
        });
    }
    const { catalogItem } = schema;
    const [from, into] = await Promise.all(
        [fromId, intoId].map((id) =>
            db().query.catalogItem.findFirst({ where: eq(catalogItem.id, id) })
        )
    );
    if (!from || !into) {
        throw new HTTPException(404, { message: 'Item not found' });
    }
    await db().transaction(async (tx) => {
        if (!into.seriesId && from.seriesId) {
            await tx
                .update(catalogItem)
                .set({
                    seriesId: from.seriesId,
                    position: from.position,
                    kind: from.kind,
                    updatedAt: new Date(),
                })
                .where(eq(catalogItem.id, into.id));
        }
        await moveItemInto(tx, from.id, into.id, { pending: false });
    });
    const seriesIds = new Set(
        [from.seriesId, into.seriesId].filter((id) => id !== null)
    );
    await Promise.all([...seriesIds].map(refreshSeriesCover));
}

/**
 * Puts an ISBN on an item as another edition of it. A new ISBN is looked up
 * first, then joins like a scan picking this volume would, waiting on an
 * admin. False when the ISBN is already on another book with a series.
 */
export async function addEdition(
    itemId: string,
    isbn: string,
    userId: string
): Promise<boolean> {
    const { item } = await findOrCreateBook(isbn, userId);
    return item.id === itemId || joinItem(item.id, itemId);
}

/**
 * Returns the catalog item for an ISBN. The user's series and volume are
 * saved only when the item has no series yet and isn't verified, since Open
 * Library's series data is unreliable. After that, only admins change them.
 *
 * When the series already has an item at that volume, the ISBN joins it as
 * another edition, waiting on an admin. Otherwise the item takes the spot.
 */
export async function upsertBook(
    isbn: string,
    seriesChoice: SeriesChoice | null,
    volume: number | null,
    userId: string
): Promise<CatalogItem> {
    const { item } = await findOrCreateBook(isbn, userId);
    if (item.seriesId || item.verifiedAt) {
        return item;
    }

    const series = seriesChoice
        ? await seriesForItem(seriesChoice, item, { userId, admin: false })
        : null;

    const sameVolume =
        series && volume !== null
            ? await findVolume(series.id, volume, item.id)
            : null;
    if (sameVolume) {
        const joined = await joinItem(item.id, sameVolume.id);
        return joined ? sameVolume : ((await findBookByIsbn(isbn)) ?? item);
    }

    const { catalogItem } = schema;
    const [updated] = await db()
        .update(catalogItem)
        .set({
            seriesId: series?.id ?? null,
            position: volume,
            kind: kindInSeries(series, item.kind),
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(catalogItem.id, item.id),
                isNull(catalogItem.seriesId),
                isNull(catalogItem.verifiedAt)
            )
        )
        .returning();
    if (!updated) {
        return (await findBookByIsbn(isbn)) ?? item;
    }

    if (updated.seriesId) {
        await refreshSeriesCover(updated.seriesId);
    }
    return updated;
}

/**
 * Makes a new item for one of an item's ISBNs, taking the collection entries
 * that own it. Their members' status and reviews move too, unless those
 * collections still have the old item. Null when the ISBN is gone.
 */
async function moveIsbnToNewItem(
    fromId: string,
    isbn: string,
    lookup: Lookup,
    userId: string
): Promise<string | null> {
    const {
        catalogItemIsbn,
        collectionItem,
        collectionItemIsbn,
        collectionMember,
        progress,
    } = schema;
    return db().transaction(async (tx) => {
        const created = await createItemClaimingIsbn(
            tx,
            lookup,
            userId,
            async (itemId) => {
                const [moved] = await tx
                    .update(catalogItemIsbn)
                    .set({
                        catalogItemId: itemId,
                        main: true,
                        pending: false,
                        ...isbnFacts(lookup.book),
                    })
                    .where(
                        and(
                            eq(catalogItemIsbn.isbn, isbn),
                            eq(catalogItemIsbn.catalogItemId, fromId)
                        )
                    )
                    .returning({ isbn: catalogItemIsbn.isbn });
                return !!moved;
            }
        );
        if (!created) {
            return null;
        }

        const entries = await tx
            .select({
                id: collectionItem.id,
                collectionId: collectionItem.collectionId,
                addedByUserId: collectionItem.addedByUserId,
            })
            .from(collectionItemIsbn)
            .innerJoin(
                collectionItem,
                eq(collectionItem.id, collectionItemIsbn.collectionItemId)
            )
            .where(
                and(
                    eq(collectionItemIsbn.isbn, isbn),
                    eq(collectionItem.catalogItemId, fromId)
                )
            );
        if (!entries.length) {
            return created;
        }
        const otherEditions = await tx
            .select({ entryId: collectionItemIsbn.collectionItemId })
            .from(collectionItemIsbn)
            .where(
                and(
                    inArray(
                        collectionItemIsbn.collectionItemId,
                        entries.map((entry) => entry.id)
                    ),
                    ne(collectionItemIsbn.isbn, isbn)
                )
            );
        const ownsOthers = new Set(otherEditions.map((row) => row.entryId));
        // An entry owning only this edition moves with it. One that also
        // owns others stays, and a new entry in its collection takes this one.
        const whole = entries.filter((entry) => !ownsOthers.has(entry.id));
        const shared = entries.filter((entry) => ownsOthers.has(entry.id));
        if (whole.length) {
            await tx
                .update(collectionItem)
                .set({ catalogItemId: created, updatedAt: new Date() })
                .where(
                    inArray(
                        collectionItem.id,
                        whole.map((entry) => entry.id)
                    )
                );
        }
        if (shared.length) {
            await tx.delete(collectionItemIsbn).where(
                and(
                    inArray(
                        collectionItemIsbn.collectionItemId,
                        shared.map((entry) => entry.id)
                    ),
                    eq(collectionItemIsbn.isbn, isbn)
                )
            );
            const added = await tx
                .insert(collectionItem)
                .values(
                    shared.map((entry) => ({
                        collectionId: entry.collectionId,
                        catalogItemId: created,
                        addedByUserId: entry.addedByUserId,
                    }))
                )
                .returning({ id: collectionItem.id });
            await tx
                .insert(collectionItemIsbn)
                .values(
                    added.map((entry) => ({ collectionItemId: entry.id, isbn }))
                );
        }
        const owners = await tx
            .selectDistinct({ id: collectionMember.userId })
            .from(collectionMember)
            .where(
                inArray(
                    collectionMember.collectionId,
                    entries.map((entry) => entry.collectionId)
                )
            );
        const stillOwners = await tx
            .selectDistinct({ id: collectionMember.userId })
            .from(collectionMember)
            .innerJoin(
                collectionItem,
                eq(collectionItem.collectionId, collectionMember.collectionId)
            )
            .where(eq(collectionItem.catalogItemId, fromId));
        const staying = new Set(stillOwners.map((row) => row.id));
        const movers = owners
            .map((row) => row.id)
            .filter((id) => !staying.has(id));
        if (movers.length) {
            await tx
                .update(progress)
                .set({ catalogItemId: created, updatedAt: new Date() })
                .where(
                    and(
                        eq(progress.catalogItemId, fromId),
                        inArray(progress.userId, movers)
                    )
                );
        }
        return created;
    });
}

/**
 * Makes one of an item's ISBNs its own item, for when a scan put it on the
 * wrong book. Returns the new item's id.
 */
export async function splitOffIsbn(
    itemId: string,
    isbn: string,
    userId: string
): Promise<string> {
    const found = await db().query.catalogItemIsbn.findFirst({
        where: and(
            eq(schema.catalogItemIsbn.isbn, isbn),
            eq(schema.catalogItemIsbn.catalogItemId, itemId)
        ),
    });
    if (!found) {
        throw new HTTPException(404, { message: 'ISBN not found' });
    }
    if (found.main) {
        throw new HTTPException(400, {
            message: "This is the item's main ISBN",
        });
    }
    const lookup = await lookupBook(isbn, {
        stored: null,
        google: true,
        openLibrary: true,
        refresh: true,
    });
    if (!lookup) {
        throw new HTTPException(404, {
            message: `No book found for ISBN ${isbn}`,
        });
    }
    const created = await moveIsbnToNewItem(itemId, isbn, lookup, userId);
    if (!created) {
        throw new HTTPException(409, {
            message: 'Another item already has this ISBN',
        });
    }
    if (lookup.later) {
        void saveLater(created, lookup.later);
    }
    return created;
}
