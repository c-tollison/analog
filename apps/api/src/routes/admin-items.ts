import { and, asc, eq, schema } from '@analog/db';
import {
    AdminListQuerySchema,
    SetVerifiedSchema,
    UpdateCatalogItemSchema,
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
import { db } from '../lib/init.js';
import { paginateWithTotal } from '../lib/pagination.js';
import { IdParamSchema } from '../lib/params.js';
import { catalogItemsMatching, searchTerms } from '../lib/search.js';
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

const adminItems = new Hono<AppEnv>()
    .get('/', schemaValidator('query', AdminListQuerySchema), async (c) => {
        const { q, status, sort, ...page } = c.req.valid('query');
        const where = and(
            whereVerified(catalogItem.verifiedAt, status),
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
                    id: catalogItem.id,
                    title: catalogItem.title,
                    format: catalogItem.format,
                    kind: catalogItem.kind,
                    barcode: catalogItem.barcode,
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
        ]);
        if (!row) {
            throw new HTTPException(404, { message: 'Item not found' });
        }
        const { metadata, externalSource, externalId, ...item } = row;
        return c.json({ ...item, collectionCount, links: itemLinks(row) });
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
