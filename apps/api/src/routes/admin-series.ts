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
    SetSeriesVolumesSchema,
    SetVerifiedSchema,
    UpdateSeriesSchema,
} from '@analog/types';

import {
    byAdded,
    totalCount,
    verifiedBy,
    verifiedByUser,
    whereVerified,
} from '../lib/admin.js';
import type { AppEnv } from '../lib/app-env.js';
import { refreshSeriesCover } from '../lib/books.js';
import { db } from '../lib/init.js';
import { paginateWithTotal } from '../lib/pagination.js';
import { IdParamSchema } from '../lib/params.js';
import { matchesAllTerms, searchTerms } from '../lib/search.js';
import { seriesDetails } from '../lib/series-details.js';
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
                        language: series.language,
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
            .select({ found: series, verifiedBy: verifiedByUser.username })
            .from(series)
            .leftJoin(
                verifiedByUser,
                eq(series.verifiedByUserId, verifiedByUser.id)
            )
            .where(eq(series.id, c.req.valid('param').id));
        if (!row) {
            throw new HTTPException(404, { message: 'Series not found' });
        }
        const { found } = row;
        // Other series this one may duplicate, to merge.
        const sameTitle = await db()
            .select({ id: series.id, title: series.title })
            .from(series)
            .where(
                and(
                    ne(series.id, found.id),
                    sql`lower(${series.title}) = lower(${found.title})`,
                    sql`${series.language} is not distinct from ${found.language}`
                )
            );
        const details = seriesDetails(found);

        return c.json({
            id: found.id,
            title: found.title,
            kind: found.kind,
            language: found.language,
            coverUrl: found.coverUrl,
            createdAt: found.createdAt,
            verifiedAt: found.verifiedAt,
            verifiedBy: row.verifiedBy,
            detailsSource: details.detailsSource,
            detailsId: details.detailsId,
            detailsTitle: details.detailsTitle,
            volumeCount: details.volumeCount,
            links: details.links,
            sameTitle,
        });
    })
    // Every item, so all the volume numbers can be edited at once.
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
            const { title, kind, language } = c.req.valid('json');
            await db().transaction(async (tx) => {
                await tx
                    .update(series)
                    .set({ title, kind, language, updatedAt: new Date() })
                    .where(eq(series.id, found.id));
                // The series' kind wins, so its items all match.
                if (kind !== found.kind) {
                    await tx
                        .update(catalogItem)
                        .set({ kind, updatedAt: new Date() })
                        .where(eq(catalogItem.seriesId, found.id));
                }
            });
            return c.body(null, 204);
        }
    )
    .put(
        '/:id/volumes',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', SetSeriesVolumesSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { volumes } = c.req.valid('json');
            await requireSeries(id);
            const ids = volumes.map((v) => v.id);
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
                for (const { id: itemId, volume } of volumes) {
                    await tx
                        .update(catalogItem)
                        .set({ position: volume, updatedAt: new Date() })
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
            const [updated] = await db()
                .update(series)
                .set(verifiedBy(verified, c.get('user').id))
                .where(eq(series.id, id))
                .returning({ id: series.id });
            if (!updated) {
                throw new HTTPException(404, { message: 'Series not found' });
            }
            return c.body(null, 204);
        }
    )
    // Moves every item into another series, then deletes this one. The other
    // series keeps its own title, language, link and volume count.
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
            await db().transaction(async (tx) => {
                await tx
                    .update(catalogItem)
                    .set({
                        seriesId: into.id,
                        kind: into.kind,
                        updatedAt: new Date(),
                    })
                    .where(eq(catalogItem.seriesId, id));
                await tx.delete(series).where(eq(series.id, id));
            });
            await refreshSeriesCover(into.id);
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
