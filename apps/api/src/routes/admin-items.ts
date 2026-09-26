import { and, asc, eq, inArray, or, type SQL, schema } from '@analog/db';
import {
    AdminListQuerySchema,
    SetVerifiedSchema,
    UpdateCatalogItemSchema,
} from '@analog/types';

import {
    addedByUser,
    byAdded,
    totalCount,
    verifiedBy,
    verifiedByUser,
    whereVerified,
} from '../lib/admin.js';
import type { AppEnv } from '../lib/app-env.js';
import {
    itemDetails,
    refreshSeriesCover,
    seriesForItem,
} from '../lib/books.js';
import { db } from '../lib/init.js';
import { paginateWithTotal } from '../lib/pagination.js';
import { IdParamSchema } from '../lib/params.js';
import { matchesTerm, searchTerms, termNumber } from '../lib/search.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

const { catalogItem, collectionItem, series } = schema;

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

/**
 * Items whose own title or series title matches every term, or whose volume
 * is a number term. Each title is looked up through its own trigram index and
 * the ids combined. One condition across both tables would make Postgres
 * check every row.
 */
function itemsMatching(terms: string[]): SQL | undefined {
    if (!terms.length) {
        return undefined;
    }
    return and(
        ...terms.map((term) => {
            const byTitle = db()
                .select({ id: catalogItem.id })
                .from(catalogItem)
                .where(matchesTerm(term, catalogItem.title));
            const bySeries = db()
                .select({ id: catalogItem.id })
                .from(catalogItem)
                .innerJoin(series, eq(catalogItem.seriesId, series.id))
                .where(matchesTerm(term, series.title));
            const ids = inArray(catalogItem.id, byTitle.union(bySeries));
            const number = termNumber(term);
            return number === null
                ? ids
                : or(eq(catalogItem.position, number), ids);
        })
    );
}

const adminItems = new Hono<AppEnv>()
    .get('/', schemaValidator('query', AdminListQuerySchema), async (c) => {
        const { q, status, sort, ...page } = c.req.valid('query');
        const where = and(
            whereVerified(catalogItem.verifiedAt, status),
            itemsMatching(searchTerms(q ?? ''))
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
                        addedBy: addedByUser.username,
                        createdAt: catalogItem.createdAt,
                        verifiedAt: catalogItem.verifiedAt,
                    })
                    .from(catalogItem)
                    .leftJoin(series, eq(catalogItem.seriesId, series.id))
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
        const [[row], collectionCount] = await Promise.all([
            db()
                .select({
                    item: catalogItem,
                    seriesTitle: series.title,
                    addedBy: addedByUser.username,
                    verifiedBy: verifiedByUser.username,
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
        ]);
        if (!row) {
            throw new HTTPException(404, { message: 'Item not found' });
        }
        const { item, ...extra } = row;

        return c.json({
            id: item.id,
            title: item.title,
            format: item.format,
            kind: item.kind,
            barcode: item.barcode,
            coverUrl: item.coverUrl,
            position: item.position,
            seriesId: item.seriesId,
            createdAt: item.createdAt,
            verifiedAt: item.verifiedAt,
            googleBooksFetchedAt: item.googleBooksFetchedAt,
            openLibraryFetchedAt: item.openLibraryFetchedAt,
            ...extra,
            collectionCount,
            links: itemDetails(item).links,
        });
    })
    .put(
        '/:id',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', UpdateCatalogItemSchema),
        async (c) => {
            const item = await requireItem(c.req.valid('param').id);
            const { title, series: choice, volume } = c.req.valid('json');
            const next = choice ? await seriesForItem(choice, item) : null;

            await db()
                .update(catalogItem)
                .set({
                    title,
                    seriesId: next?.id ?? null,
                    position: volume,
                    // The series' kind wins, so its items all match.
                    kind: next?.kind ?? item.kind,
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
            const [updated] = await db()
                .update(catalogItem)
                .set(verifiedBy(verified, c.get('user').id))
                .where(eq(catalogItem.id, id))
                .returning({ id: catalogItem.id });
            if (!updated) {
                throw new HTTPException(404, { message: 'Item not found' });
            }
            return c.body(null, 204);
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
