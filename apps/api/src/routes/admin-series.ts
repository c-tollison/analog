import {
    and,
    asc,
    count,
    eq,
    inArray,
    isNotNull,
    ne,
    schema,
    sql,
} from '@analog/db';
import {
    AdminListQuerySchema,
    MAX_SERIES_VOLUMES,
    MergeSeriesSchema,
    SetSeriesItemsSchema,
    SetVerifiedSchema,
    UpdateSeriesSchema,
} from '@analog/types';

import {
    byAdded,
    setVerified,
    totalCount,
    verifiedByUser,
    whereVerified,
} from '../lib/admin.js';
import type { AppEnv } from '../lib/app-env.js';
import {
    matchSeriesKind,
    mergeSeries,
    refreshSeriesCover,
} from '../lib/books.js';
import { db } from '../lib/init.js';
import { paginateWithTotal } from '../lib/pagination.js';
import { IdParamSchema } from '../lib/params.js';
import { matchesAllTerms, searchTerms } from '../lib/search.js';
import { seriesDetails, seriesLinks } from '../lib/series-details.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

const { catalogItem, series } = schema;

// How many items each series has, to join on the series id.
function itemCounts() {
    return db()
        .select({
            seriesId: catalogItem.seriesId,
            itemCount: count().as('item_count'),
        })
        .from(catalogItem)
        .where(isNotNull(catalogItem.seriesId))
        .groupBy(catalogItem.seriesId)
        .as('item_counts');
}

async function requireSeries(id: string) {
    const found = await db().query.series.findFirst({
        where: eq(series.id, id),
    });
    if (!found) {
        throw new HTTPException(404, { message: 'Series not found' });
    }
    return found;
}

const adminSeries = new Hono<AppEnv>()
    .get('/', schemaValidator('query', AdminListQuerySchema), async (c) => {
        const { q, status, sort, ...page } = c.req.valid('query');
        const where = and(
            whereVerified(series.verifiedAt, status),
            matchesAllTerms(searchTerms(q ?? ''), { columns: [series.title] })
        );

        const counts = itemCounts();

        const result = await paginateWithTotal(
            page,
            (limit, offset) =>
                db()
                    .select({
                        id: series.id,
                        title: series.title,
                        kind: series.kind,
                        coverUrl: series.coverUrl,
                        itemCount: sql<number>`coalesce(${counts.itemCount}, 0)::int`,
                        volumeCount: series.volumeCount,
                        detailsSource: series.detailsSource,
                        createdAt: series.createdAt,
                        verifiedAt: series.verifiedAt,
                    })
                    .from(series)
                    .leftJoin(counts, eq(counts.seriesId, series.id))
                    .where(where)
                    .orderBy(byAdded(series.createdAt, sort), asc(series.id))
                    .limit(limit)
                    .offset(offset),
            async () => {
                const [row] = await db()
                    .select({ total: totalCount })
                    .from(series)
                    .where(where);
                return row?.total ?? 0;
            }
        );
        return c.json(result);
    })
    .get('/:id', schemaValidator('param', IdParamSchema), async (c) => {
        const [row] = await db()
            .select({
                id: series.id,
                title: series.title,
                kind: series.kind,
                coverUrl: series.coverUrl,
                volumeCount: series.volumeCount,
                createdAt: series.createdAt,
                verifiedBy: verifiedByUser.username,
                verifiedAt: series.verifiedAt,
                // Only read to work out the AniList link.
                detailsSource: series.detailsSource,
                detailsId: series.detailsId,
                details: series.details,
                detailsFetchedAt: series.detailsFetchedAt,
            })
            .from(series)
            .leftJoin(
                verifiedByUser,
                eq(series.verifiedByUserId, verifiedByUser.id)
            )
            .where(eq(series.id, c.req.valid('param').id));
        if (!row) {
            throw new HTTPException(404, { message: 'Series not found' });
        }
        // Other series this one may duplicate, to merge.
        const sameTitle = await db()
            .select({ id: series.id, title: series.title })
            .from(series)
            .where(
                and(
                    ne(series.id, row.id),
                    sql`lower(${series.title}) = lower(${row.title})`
                )
            );
        const { details, detailsFetchedAt, ...found } = row;
        const { detailsSource, detailsId, detailsTitle } = seriesDetails(row);
        return c.json({
            ...found,
            detailsSource,
            detailsId,
            detailsTitle,
            links: seriesLinks(row),
            sameTitle,
        });
    })
    // Every item, so they can all be edited at once.
    .get('/:id/items', schemaValidator('param', IdParamSchema), async (c) => {
        const { id } = c.req.valid('param');
        await requireSeries(id);
        const items = await db()
            .select({
                id: catalogItem.id,
                title: catalogItem.title,
                coverUrl: catalogItem.coverUrl,
                position: catalogItem.position,
                verifiedAt: catalogItem.verifiedAt,
            })
            .from(catalogItem)
            .where(eq(catalogItem.seriesId, id))
            .orderBy(
                sql`${catalogItem.position} asc nulls last`,
                asc(catalogItem.title),
                asc(catalogItem.id)
            )
            .limit(MAX_SERIES_VOLUMES);
        return c.json(items);
    })
    .put(
        '/:id',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', UpdateSeriesSchema),
        async (c) => {
            const found = await requireSeries(c.req.valid('param').id);
            const { title, kind } = c.req.valid('json');
            await db().transaction(async (tx) => {
                await tx
                    .update(series)
                    .set({ title, kind, updatedAt: new Date() })
                    .where(eq(series.id, found.id));
                if (kind !== found.kind) {
                    await matchSeriesKind(found.id, tx);
                }
            });
            return c.body(null, 204);
        }
    )
    .put(
        '/:id/items',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', SetSeriesItemsSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { items } = c.req.valid('json');
            const me = c.get('user').id;
            await requireSeries(id);
            const ids = items.map((item) => item.id);
            const inSeries = await db()
                .select({ id: catalogItem.id })
                .from(catalogItem)
                .where(
                    and(
                        eq(catalogItem.seriesId, id),
                        inArray(catalogItem.id, ids)
                    )
                );
            if (inSeries.length !== new Set(ids).size) {
                throw new HTTPException(400, {
                    message: "Some items aren't in this series",
                });
            }
            await db().transaction(async (tx) => {
                for (const { id: itemId, title, volume, verified } of items) {
                    await tx
                        .update(catalogItem)
                        .set({
                            title,
                            position: volume,
                            // Items already verified keep who verified them.
                            verifiedAt: verified
                                ? sql`coalesce(${catalogItem.verifiedAt}, now())`
                                : null,
                            verifiedByUserId: verified
                                ? sql`case when ${catalogItem.verifiedAt} is null
                                    then ${me}::uuid
                                    else ${catalogItem.verifiedByUserId} end`
                                : null,
                            updatedAt: new Date(),
                        })
                        .where(eq(catalogItem.id, itemId));
                }
            });
            await refreshSeriesCover(id);
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
            if (!(await setVerified(series, id, by))) {
                throw new HTTPException(404, { message: 'Series not found' });
            }
            return c.body(null, 204);
        }
    )
    // Moves every item into another series, then deletes this one. The other
    // series keeps its own title, link and volume count.
    .post(
        '/:id/merge',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', MergeSeriesSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { intoSeriesId } = c.req.valid('json');
            if (id === intoSeriesId) {
                throw new HTTPException(400, {
                    message: "A series can't be merged into itself",
                });
            }
            await requireSeries(id);
            const into = await requireSeries(intoSeriesId);
            await mergeSeries(id, into.id);
            return c.body(null, 204);
        }
    )
    .delete('/:id', schemaValidator('param', IdParamSchema), async (c) => {
        const { id } = c.req.valid('param');
        await requireSeries(id);
        if (await db().$count(catalogItem, eq(catalogItem.seriesId, id))) {
            throw new HTTPException(409, {
                message: 'Move or merge its items before deleting it',
            });
        }
        await db().delete(series).where(eq(series.id, id));
        return c.body(null, 204);
    });

export default adminSeries;
