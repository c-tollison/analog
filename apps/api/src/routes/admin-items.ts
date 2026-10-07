import {
    and,
    asc,
    eq,
    inArray,
    isNull,
    notInArray,
    or,
    type SQL,
    schema,
    sql,
} from '@analog/db';
import {
    AdminAddBookSchema,
    AdminItemListQuerySchema,
    IsbnSchema,
    MergeItemSchema,
    PersonRole,
    SetVerifiedSchema,
    UpdateCatalogItemSchema,
    UpdateIsbnSchema,
    UpdateItemDetailsSchema,
    VerifiedFilter,
} from '@analog/types';

import {
    addedByUser,
    byAdded,
    setVerified,
    totalCount,
    verifiedByUser,
    whereVerified,
} from '../lib/admin.js';
import type { AppEnv } from '../lib/app-env.js';
import {
    creditList,
    creditNames,
    findOrCreatePublisher,
    inheritSeriesGenres,
    itemCredits,
    setEditionPeople,
    setItemGenres,
    setItemPeople,
    withPeople,
} from '../lib/book-values.js';
import {
    bookLinks,
    kindInSeries,
    refreshSeriesCover,
    seriesForItem,
} from '../lib/books.js';
import {
    checkCountsByItem,
    clearAppliedItemChecks,
    clearItemChecks,
} from '../lib/checks.js';
import { toCover, uploadedCoverUrl } from '../lib/covers.js';
import {
    mergeItem,
    removeIsbn,
    splitOffIsbn,
    upsertBook,
} from '../lib/editions.js';
import { db } from '../lib/init.js';
import { paginateWithTotal } from '../lib/pagination.js';
import { IdParamSchema } from '../lib/params.js';
import { catalogItemsMatching, searchTerms } from '../lib/search.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const {
    catalogItem,
    catalogItemIsbn,
    catalogItemIsbnCover,
    catalogItemGenre,
    catalogItemIsbnPerson,
    catalogItemPerson,
    collectionItem,
    person,
    publisher,
    series,
} = schema;

const ItemIsbnParamSchema = IdParamSchema.extend({ isbn: IsbnSchema });
const CoverFormSchema = z.object({
    file: z.instanceof(File, { message: 'Choose an image' }),
});

function itemIdsWithPendingIsbn() {
    return db()
        .select({ id: catalogItemIsbn.catalogItemId })
        .from(catalogItemIsbn)
        .where(eq(catalogItemIsbn.pending, true));
}

// An item needs checking until it's verified and has no pending ISBNs.
function whereItemVerified(status: VerifiedFilter): SQL | undefined {
    const verified = whereVerified(catalogItem.verifiedAt, status);
    if (status === VerifiedFilter.Verified) {
        return and(
            verified,
            notInArray(catalogItem.id, itemIdsWithPendingIsbn())
        );
    }
    if (status === VerifiedFilter.Unverified) {
        return or(verified, inArray(catalogItem.id, itemIdsWithPendingIsbn()));
    }
    return verified;
}

async function requireItem(id: string) {
    const item = await db().query.catalogItem.findFirst({
        where: eq(catalogItem.id, id),
    });
    if (!item) {
        throw new HTTPException(404, { message: 'Book not found' });
    }
    return item;
}

async function refreshCovers(seriesIds: (string | null)[]) {
    const unique = new Set(seriesIds.filter((id) => id !== null));
    await Promise.all([...unique].map(refreshSeriesCover));
}

const adminItems = new Hono<AppEnv>()
    .get('/', schemaValidator('query', AdminItemListQuerySchema), async (c) => {
        const { q, status, sort, noCover, ...page } = c.req.valid('query');
        const where = and(
            whereItemVerified(status),
            noCover ? isNull(catalogItem.coverUrl) : undefined,
            catalogItemsMatching(searchTerms(q ?? ''))
        );
        const checks = checkCountsByItem();

        const result = await paginateWithTotal(
            page,
            (limit, offset) =>
                db()
                    .select({
                        id: catalogItem.id,
                        title: catalogItem.title,
                        coverUrl: catalogItem.coverUrl,
                        kind: catalogItem.kind,
                        position: catalogItem.position,
                        seriesTitle: series.title,
                        mainIsbn: catalogItemIsbn.isbn,
                        addedBy: addedByUser.username,
                        createdAt: catalogItem.createdAt,
                        verifiedAt: catalogItem.verifiedAt,
                        suggestions: sql<number>`coalesce(${checks.checkCount}, 0)::int`,
                    })
                    .from(catalogItem)
                    .leftJoin(series, eq(catalogItem.seriesId, series.id))
                    .leftJoin(checks, eq(checks.itemId, catalogItem.id))
                    .leftJoin(
                        catalogItemIsbn,
                        and(
                            eq(catalogItemIsbn.catalogItemId, catalogItem.id),
                            eq(catalogItemIsbn.main, true)
                        )
                    )
                    .leftJoin(
                        addedByUser,
                        eq(catalogItem.createdByUserId, addedByUser.id)
                    )
                    .where(where)
                    .orderBy(
                        byAdded(catalogItem.createdAt, sort),
                        asc(catalogItem.id)
                    )
                    .limit(limit)
                    .offset(offset),
            async () => {
                const [row] = await db()
                    .select({ total: totalCount })
                    .from(catalogItem)
                    .where(where);
                return row?.total ?? 0;
            }
        );
        return c.json(result);
    })
    // Adds a book to the shared catalog without a collection. Any series can
    // be picked.
    .post('/', schemaValidator('json', AdminAddBookSchema), async (c) => {
        const {
            isbn,
            series: seriesChoice,
            volume,
            googleId,
        } = c.req.valid('json');
        const item = await upsertBook(
            isbn,
            seriesChoice,
            volume,
            { userId: c.get('user').id, admin: true },
            googleId
        );
        return c.json({ id: item.id, seriesId: item.seriesId }, 201);
    })
    .get('/:id', schemaValidator('param', IdParamSchema), async (c) => {
        const { id } = c.req.valid('param');
        const [[row], collectionCount, isbns, people, itemPeople, genres] =
            await Promise.all([
                db()
                    .select({
                        id: catalogItem.id,
                        title: catalogItem.title,
                        kind: catalogItem.kind,
                        coverUrl: catalogItem.coverUrl,
                        position: catalogItem.position,
                        subtitle: catalogItem.subtitle,
                        description: catalogItem.description,
                        firstPublishedYear: catalogItem.firstPublishedYear,
                        audience: catalogItem.audience,
                        saveCount: catalogItem.saveCount,
                        seriesId: catalogItem.seriesId,
                        seriesTitle: series.title,
                        addedBy: addedByUser.username,
                        createdAt: catalogItem.createdAt,
                        verifiedBy: verifiedByUser.username,
                        verifiedAt: catalogItem.verifiedAt,
                        googleBooksFetchedAt: catalogItem.googleBooksFetchedAt,
                        openLibraryFetchedAt: catalogItem.openLibraryFetchedAt,
                        // Only read to build the links.
                        externalSource: catalogItem.externalSource,
                        externalId: catalogItem.externalId,
                    })
                    .from(catalogItem)
                    .leftJoin(series, eq(catalogItem.seriesId, series.id))
                    .leftJoin(
                        addedByUser,
                        eq(catalogItem.createdByUserId, addedByUser.id)
                    )
                    .leftJoin(
                        verifiedByUser,
                        eq(catalogItem.verifiedByUserId, verifiedByUser.id)
                    )
                    .where(eq(catalogItem.id, id)),
                db().$count(
                    collectionItem,
                    eq(collectionItem.catalogItemId, id)
                ),
                db()
                    .select({
                        isbn: catalogItemIsbn.isbn,
                        title: catalogItemIsbn.title,
                        editionName: catalogItemIsbn.editionName,
                        coverUrl: catalogItemIsbn.coverUrl,
                        publisher: publisher.name,
                        language: catalogItemIsbn.language,
                        format: catalogItemIsbn.format,
                        releaseYear: catalogItemIsbn.releaseYear,
                        releaseDate: catalogItemIsbn.releaseDate,
                        pageCount: catalogItemIsbn.pageCount,
                        goodreadsId: catalogItemIsbn.goodreadsId,
                        main: catalogItemIsbn.main,
                        pending: catalogItemIsbn.pending,
                    })
                    .from(catalogItemIsbn)
                    .leftJoin(
                        publisher,
                        eq(publisher.id, catalogItemIsbn.publisherId)
                    )
                    .where(eq(catalogItemIsbn.catalogItemId, id))
                    .orderBy(
                        asc(catalogItemIsbn.createdAt),
                        asc(catalogItemIsbn.isbn)
                    ),
                db()
                    .select({
                        isbn: catalogItemIsbnPerson.isbn,
                        role: catalogItemIsbnPerson.role,
                        position: catalogItemIsbnPerson.position,
                        name: person.name,
                    })
                    .from(catalogItemIsbnPerson)
                    .innerJoin(
                        catalogItemIsbn,
                        eq(catalogItemIsbn.isbn, catalogItemIsbnPerson.isbn)
                    )
                    .innerJoin(
                        person,
                        eq(person.id, catalogItemIsbnPerson.personId)
                    )
                    .where(eq(catalogItemIsbn.catalogItemId, id)),
                db().query.catalogItemPerson.findMany({
                    where: eq(catalogItemPerson.catalogItemId, id),
                    ...withPeople.people,
                }),
                db().query.catalogItemGenre.findMany({
                    columns: { genreSlug: true },
                    where: eq(catalogItemGenre.catalogItemId, id),
                }),
            ]);
        if (!row) {
            throw new HTTPException(404, { message: 'Book not found' });
        }
        const { externalSource, externalId, ...item } = row;
        const main = isbns.find((edition) => edition.main);
        return c.json({
            ...item,
            genres: genres.map(({ genreSlug }) => genreSlug),
            authors: creditNames(itemPeople, PersonRole.Author),
            illustrators: creditNames(itemPeople, PersonRole.Illustrator),
            collectionCount,
            isbns: isbns.map((edition) => ({
                ...edition,
                credits: creditList(
                    people
                        .filter((credit) => credit.isbn === edition.isbn)
                        .map(({ role, position, name }) => ({
                            role,
                            position,
                            person: { name },
                        }))
                ),
            })),
            links: bookLinks(row, main?.goodreadsId ?? null),
        });
    })
    .put(
        '/:id',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', UpdateCatalogItemSchema),
        async (c) => {
            const item = await requireItem(c.req.valid('param').id);
            const {
                title,
                subtitle,
                series: choice,
                volume,
            } = c.req.valid('json');
            const next = choice
                ? await seriesForItem(choice, item, {
                      userId: c.get('user').id,
                      admin: true,
                  })
                : null;

            await db()
                .update(catalogItem)
                .set({
                    title,
                    subtitle,
                    seriesId: next?.id ?? null,
                    position: volume,
                    kind: kindInSeries(next, item.kind),
                    updatedAt: new Date(),
                })
                .where(eq(catalogItem.id, item.id));
            await clearAppliedItemChecks(item.id, {
                title,
                volume,
                seriesId: next?.id ?? null,
            });
            if (next && next.id !== item.seriesId) {
                await inheritSeriesGenres(item.id, next.id);
            }
            await refreshCovers([item.seriesId, next?.id ?? null]);
            return c.body(null, 204);
        }
    )
    .put(
        '/:id/details',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', UpdateItemDetailsSchema),
        async (c) => {
            const item = await requireItem(c.req.valid('param').id);
            const { kind, authors, illustrators, genres, ...details } =
                c.req.valid('json');
            await db().transaction(async (tx) => {
                await tx
                    .update(catalogItem)
                    .set({
                        ...details,
                        ...(kind && !item.seriesId ? { kind } : {}),
                        updatedAt: new Date(),
                    })
                    .where(eq(catalogItem.id, item.id));
                await setItemPeople(
                    item.id,
                    itemCredits({ authors, illustrators }),
                    tx
                );
                await setItemGenres(item.id, genres, tx);
            });
            return c.body(null, 204);
        }
    )
    .put(
        '/:id/verified',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', SetVerifiedSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { verified } = c.req.valid('json');
            const by = verified ? c.get('user').id : null;
            if (!(await setVerified(catalogItem, id, by))) {
                throw new HTTPException(404, { message: 'Book not found' });
            }
            if (verified) {
                await clearItemChecks([id]);
            }
            return c.body(null, 204);
        }
    )
    // Merges this item into another for the same book, the opposite of
    // splitting an ISBN off.
    .post(
        '/:id/merge',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', MergeItemSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { intoItemId } = c.req.valid('json');
            await mergeItem(id, intoItemId);
            return c.body(null, 204);
        }
    )
    // Makes an ISBN a scan put on the wrong book its own item.
    .post(
        '/:id/isbns/:isbn/split',
        schemaValidator('param', ItemIsbnParamSchema),
        async (c) => {
            const { id, isbn } = c.req.valid('param');
            const created = await splitOffIsbn(id, isbn, c.get('user').id);
            return c.json({ id: created }, 201);
        }
    )
    .delete(
        '/:id/isbns/:isbn',
        schemaValidator('param', ItemIsbnParamSchema),
        async (c) => {
            const { id, isbn } = c.req.valid('param');
            await removeIsbn(id, isbn);
            return c.body(null, 204);
        }
    )
    .put(
        '/:id/isbns/:isbn',
        schemaValidator('param', ItemIsbnParamSchema),
        schemaValidator('json', UpdateIsbnSchema),
        async (c) => {
            const { id, isbn } = c.req.valid('param');
            const {
                publisher: publisherName,
                credits,
                ...edition
            } = c.req.valid('json');
            const [updated] = await db()
                .update(catalogItemIsbn)
                .set({
                    ...edition,
                    // A full date sets the year.
                    releaseYear: edition.releaseDate
                        ? Number(edition.releaseDate.slice(0, 4))
                        : edition.releaseYear,
                    publisherId: await findOrCreatePublisher(publisherName),
                })
                .where(
                    and(
                        eq(catalogItemIsbn.catalogItemId, id),
                        eq(catalogItemIsbn.isbn, isbn)
                    )
                )
                .returning({ isbn: catalogItemIsbn.isbn });
            if (!updated) {
                throw new HTTPException(404, { message: 'ISBN not found' });
            }
            await setEditionPeople(isbn, credits);
            return c.body(null, 204);
        }
    )
    .put(
        '/:id/isbns/:isbn/approve',
        schemaValidator('param', ItemIsbnParamSchema),
        async (c) => {
            const { id, isbn } = c.req.valid('param');
            const [approved] = await db()
                .update(catalogItemIsbn)
                .set({ pending: false })
                .where(
                    and(
                        eq(catalogItemIsbn.catalogItemId, id),
                        eq(catalogItemIsbn.isbn, isbn)
                    )
                )
                .returning({ isbn: catalogItemIsbn.isbn });
            if (!approved) {
                throw new HTTPException(404, { message: 'ISBN not found' });
            }
            return c.body(null, 204);
        }
    )
    // Replaces the edition's cover, and the item's too when it's the main
    // ISBN. Book lookups never replace an uploaded cover.
    .put(
        '/:id/isbns/:isbn/cover',
        schemaValidator('param', ItemIsbnParamSchema),
        schemaValidator('form', CoverFormSchema),
        async (c) => {
            const { id, isbn } = c.req.valid('param');
            const data = await toCover(
                await c.req.valid('form').file.arrayBuffer()
            );
            const updatedAt = new Date();
            const coverUrl = uploadedCoverUrl(isbn, updatedAt);

            const seriesId = await db().transaction(async (tx) => {
                const [edition] = await tx
                    .update(catalogItemIsbn)
                    .set({ coverUrl })
                    .where(
                        and(
                            eq(catalogItemIsbn.catalogItemId, id),
                            eq(catalogItemIsbn.isbn, isbn)
                        )
                    )
                    .returning({ main: catalogItemIsbn.main });
                if (!edition) {
                    throw new HTTPException(404, { message: 'ISBN not found' });
                }
                await tx
                    .insert(catalogItemIsbnCover)
                    .values({ isbn, data, updatedAt })
                    .onConflictDoUpdate({
                        target: catalogItemIsbnCover.isbn,
                        set: { data, updatedAt },
                    });
                if (!edition.main) {
                    return null;
                }
                const [item] = await tx
                    .update(catalogItem)
                    .set({ coverUrl, updatedAt })
                    .where(eq(catalogItem.id, id))
                    .returning({ seriesId: catalogItem.seriesId });
                return item?.seriesId ?? null;
            });
            await refreshCovers([seriesId]);
            return c.json({ coverUrl });
        }
    )
    // Also takes it out of every collection, with everyone's progress and
    // reviews for it.
    .delete('/:id', schemaValidator('param', IdParamSchema), async (c) => {
        const [deleted] = await db()
            .delete(catalogItem)
            .where(eq(catalogItem.id, c.req.valid('param').id))
            .returning({ seriesId: catalogItem.seriesId });
        if (!deleted) {
            throw new HTTPException(404, { message: 'Book not found' });
        }
        await refreshCovers([deleted.seriesId]);
        return c.body(null, 204);
    });

export default adminItems;
