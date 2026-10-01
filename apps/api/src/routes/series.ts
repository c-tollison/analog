import { and, asc, eq, not, or, schema, sql } from '@analog/db';
import {
    DetailsSourceSchema,
    LinkDetailsSourceSchema,
    ProgressStatus,
    SeriesSearchQuerySchema,
    SeriesVolumesQuerySchema,
    SetVolumeCountSchema,
    UserRole,
} from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { discoverableItem, discoverableSeries } from '../lib/discovery.js';
import { db } from '../lib/init.js';
import { onShelfOf } from '../lib/items.js';
import { paginate } from '../lib/pagination.js';
import { IdParamSchema } from '../lib/params.js';
import { whenCompleted } from '../lib/progress.js';
import { searchSeries } from '../lib/search.js';
import {
    linkDetailsSource,
    searchDetailsSource,
    seriesDetails,
    setVolumeCount,
    unlinkDetailsSource,
} from '../lib/series-details.js';
import { schemaValidator } from '../lib/validator.js';
import { requireRole } from '../middleware/require-role.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const { catalogItem, progress, series: seriesTable } = schema;

// The series' items a person can see: ones anyone can find, ones they added,
// and ones on their shelves. Needs `progress` joined, so columns keep their
// table names.
function visibleVolumes(seriesId: string, userId: string) {
    return and(
        eq(catalogItem.seriesId, seriesId),
        or(discoverableItem(userId), onShelfOf(userId))
    );
}

function statusCount(status: ProgressStatus) {
    return sql<number>`(count(*) filter (where ${progress.status} = ${status}))::int`;
}

function myProgress(userId: string) {
    return and(
        eq(progress.catalogItemId, catalogItem.id),
        eq(progress.userId, userId)
    );
}

const DetailsSearchQuerySchema = z.object({
    source: DetailsSourceSchema,
    q: z.string().trim().min(1).max(200),
});

// Series are shared by everyone, so only admins can change them.
const series = new Hono<AppEnv>()
    .get(
        '/details-source/search',
        requireRole(UserRole.Admin),
        schemaValidator('query', DetailsSearchQuerySchema),
        async (c) => {
            const { source, q } = c.req.valid('query');
            return c.json(await searchDetailsSource(source, q));
        }
    )
    .put(
        '/:id/details-source',
        requireRole(UserRole.Admin),
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', LinkDetailsSourceSchema),
        async (c) => {
            await linkDetailsSource(
                c.req.valid('param').id,
                c.req.valid('json')
            );
            return c.body(null, 204);
        }
    )
    .delete(
        '/:id/details-source',
        requireRole(UserRole.Admin),
        schemaValidator('param', IdParamSchema),
        async (c) => {
            await unlinkDetailsSource(c.req.valid('param').id);
            return c.body(null, 204);
        }
    )
    .put(
        '/:id/volume-count',
        requireRole(UserRole.Admin),
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', SetVolumeCountSchema),
        async (c) => {
            await setVolumeCount(
                c.req.valid('param').id,
                c.req.valid('json').volumeCount
            );
            return c.body(null, 204);
        }
    )
    // Series you can find: verified ones, and ones you created.
    .get('/', schemaValidator('query', SeriesSearchQuerySchema), async (c) => {
        const { q, ...page } = c.req.valid('query');
        return c.json(
            await searchSeries(page, q, discoverableSeries(c.get('user').id))
        );
    })
    // A series' page, the same for everyone, with the person's own counts.
    .get('/:id', schemaValidator('param', IdParamSchema), async (c) => {
        const { id } = c.req.valid('param');
        const me = c.get('user').id;

        const [found, [counted]] = await Promise.all([
            db().query.series.findFirst({ where: eq(seriesTable.id, id) }),
            db()
                .select({
                    itemCount: sql<number>`count(*)::int`,
                    ownedCount: sql<number>`(count(*) filter (where ${onShelfOf(me)}))::int`,
                    completedCount: statusCount(ProgressStatus.Completed),
                    inProgressCount: statusCount(ProgressStatus.InProgress),
                    plannedCount: statusCount(ProgressStatus.Planned),
                    // Volume numbers in the app, for spotting ones that
                    // aren't.
                    positions: sql<number[]>`coalesce(
                        array_agg(distinct ${catalogItem.position}::float)
                            filter (where ${catalogItem.position} is not null),
                        '{}'
                    )`,
                })
                .from(catalogItem)
                .leftJoin(progress, myProgress(me))
                .where(visibleVolumes(id, me)),
        ]);
        // Anyone with the link can open it. Search is where unchecked series
        // stay hidden.
        if (!found) {
            throw new HTTPException(404, { message: 'Series not found' });
        }

        return c.json({
            id: found.id,
            title: found.title,
            kind: found.kind,
            coverUrl: found.coverUrl,
            ...seriesDetails(found),
            itemCount: counted?.itemCount ?? 0,
            ownedCount: counted?.ownedCount ?? 0,
            completedCount: counted?.completedCount ?? 0,
            inProgressCount: counted?.inProgressCount ?? 0,
            plannedCount: counted?.plannedCount ?? 0,
            positions: counted?.positions ?? [],
        });
    })
    .get(
        '/:id/items',
        schemaValidator('param', IdParamSchema),
        schemaValidator('query', SeriesVolumesQuerySchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { show, ...pageQuery } = c.req.valid('query');
            const me = c.get('user').id;
            const owned = onShelfOf(me);
            const shown = {
                owned,
                missing: not(owned),
                all: undefined,
            }[show];

            const page = await paginate(pageQuery, (limit, offset) =>
                db()
                    .select({
                        id: catalogItem.id,
                        format: catalogItem.format,
                        title: catalogItem.title,
                        coverUrl: catalogItem.coverUrl,
                        position: catalogItem.position,
                        status: progress.status,
                        rating: whenCompleted<number>(progress.rating),
                        owned: sql<boolean>`${onShelfOf(me)}`,
                    })
                    .from(catalogItem)
                    .leftJoin(progress, myProgress(me))
                    .where(and(visibleVolumes(id, me), shown))
                    .orderBy(
                        sql`${catalogItem.position} asc nulls last`,
                        asc(catalogItem.title),
                        asc(catalogItem.id)
                    )
                    .limit(limit)
                    .offset(offset)
            );
            return c.json(page);
        }
    );

export default series;
