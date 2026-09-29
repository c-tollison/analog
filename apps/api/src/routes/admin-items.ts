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
} from '@analog/db';
import {
    AdminItemListQuerySchema,
    IsbnSchema,
    MergeItemSchema,
    SetVerifiedSchema,
    UpdateCatalogItemSchema,
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
    itemLinks,
    kindInSeries,
    refreshSeriesCover,
    seriesForItem,
} from '../lib/books.js';
import { toCover, uploadedCoverUrl } from '../lib/covers.js';
import { mergeItem, splitOffIsbn } from '../lib/editions.js';
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
    collectionItem,
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
        throw new HTTPException(404, { message: 'Item not found' });
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
                    })
                    .from(catalogItem)
                    .leftJoin(series, eq(catalogItem.seriesId, series.id))
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
    .get('/:id', schemaValidator('param', IdParamSchema), async (c) => {
        const { id } = c.req.valid('param');
        const [[row], collectionCount, isbns] = await Promise.all([
            db()
                .select({
                    id: catalogItem.id,
                    title: catalogItem.title,
                    format: catalogItem.format,
                    kind: catalogItem.kind,
                    coverUrl: catalogItem.coverUrl,
                    position: catalogItem.position,
                    seriesId: catalogItem.seriesId,
                    seriesTitle: series.title,
                    addedBy: addedByUser.username,
                    createdAt: catalogItem.createdAt,
                    verifiedBy: verifiedByUser.username,
                    verifiedAt: catalogItem.verifiedAt,
                    googleBooksFetchedAt: catalogItem.googleBooksFetchedAt,
                    openLibraryFetchedAt: catalogItem.openLibraryFetchedAt,
                    // Only read to build the links.
                    metadata: catalogItem.metadata,
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
            db().$count(collectionItem, eq(collectionItem.catalogItemId, id)),
            db()
                .select({
                    isbn: catalogItemIsbn.isbn,
                    title: catalogItemIsbn.title,
                    coverUrl: catalogItemIsbn.coverUrl,
                    publisher: catalogItemIsbn.publisher,
                    language: catalogItemIsbn.language,
                    format: catalogItemIsbn.format,
                    main: catalogItemIsbn.main,
                    pending: catalogItemIsbn.pending,
                })
                .from(catalogItemIsbn)
                .where(eq(catalogItemIsbn.catalogItemId, id))
                .orderBy(
                    asc(catalogItemIsbn.createdAt),
                    asc(catalogItemIsbn.isbn)
                ),
        ]);
        if (!row) {
            throw new HTTPException(404, { message: 'Item not found' });
        }
        const { metadata, externalSource, externalId, ...item } = row;
        return c.json({
            ...item,
            collectionCount,
            isbns,
            links: itemLinks(row),
        });
    })
    .put(
        '/:id',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', UpdateCatalogItemSchema),
        async (c) => {
            const item = await requireItem(c.req.valid('param').id);
            const { title, series: choice, volume } = c.req.valid('json');
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
                    seriesId: next?.id ?? null,
                    position: volume,
                    kind: kindInSeries(next, item.kind),
                    updatedAt: new Date(),
                })
                .where(eq(catalogItem.id, item.id));
            await refreshCovers([item.seriesId, next?.id ?? null]);
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
                throw new HTTPException(404, { message: 'Item not found' });
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
            throw new HTTPException(404, { message: 'Item not found' });
        }
        await refreshCovers([deleted.seriesId]);
        return c.body(null, 204);
    });

export default adminItems;
