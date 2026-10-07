import { and, asc, eq, not, or, schema, sql } from '@analog/db';
import {
    ProgressStatus,
    SeriesPageQuerySchema,
    SeriesSearchQuerySchema,
    SeriesVolumesQuerySchema,
    SetVolumeCountSchema,
    UserRole,
} from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { discoverableItem, discoverableSeries } from '../lib/discovery.js';
import { db } from '../lib/init.js';
import { myShelfEntries, onShelfOf } from '../lib/items.js';
import { paginate } from '../lib/pagination.js';
import { IdParamSchema } from '../lib/params.js';
import { whenCompleted } from '../lib/progress.js';
import { searchSeries } from '../lib/search.js';
import {
    seriesDetails,
    setVolumeCount,
    volumeGenres,
} from '../lib/series-details.js';
import { schemaValidator } from '../lib/validator.js';
import { requireRole } from '../middleware/require-role.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

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

// Series are shared by everyone, so only admins can change them.
const series = new Hono<AppEnv>()
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
    .get(
        '/:id',
        schemaValidator('param', IdParamSchema),
        schemaValidator('query', SeriesPageQuerySchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { shelf } = c.req.valid('query');
            const me = c.get('user').id;

            const [found, genres, [counted]] = await Promise.all([
                db().query.series.findFirst({
                    where: eq(seriesTable.id, id),
                }),
                volumeGenres(id),
                db()
                    .select({
                        itemCount: sql<number>`count(*)::int`,
                        ownedCount: sql<number>`(count(*) filter (where ${onShelfOf(me, shelf)}))::int`,
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
            // Anyone with the link can open it. Search is where unchecked
            // series stay hidden.
            if (!found) {
                throw new HTTPException(404, { message: 'Series not found' });
            }

            return c.json({
                id: found.id,
                title: found.title,
                kind: found.kind,
                coverUrl: found.coverUrl,
                ...seriesDetails(found),
                genres: genres.map(({ name }) => name),
                itemCount: counted?.itemCount ?? 0,
                ownedCount: counted?.ownedCount ?? 0,
                completedCount: counted?.completedCount ?? 0,
                inProgressCount: counted?.inProgressCount ?? 0,
                plannedCount: counted?.plannedCount ?? 0,
                positions: counted?.positions ?? [],
            });
        }
    )
    .get(
        '/:id/items',
        schemaValidator('param', IdParamSchema),
        schemaValidator('query', SeriesVolumesQuerySchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { show, shelf, ...pageQuery } = c.req.valid('query');
            const me = c.get('user').id;
            const owned = onShelfOf(me, shelf);
            const shown = {
                owned,
                missing: not(owned),
                all: undefined,
            }[show];

            const page = await paginate(pageQuery, (limit, offset) =>
                db()
                    .select({
                        id: catalogItem.id,
                        title: catalogItem.title,
                        coverUrl: catalogItem.coverUrl,
                        position: catalogItem.position,
                        status: progress.status,
                        rating: whenCompleted<number>(progress.rating),
                        owned: sql<boolean>`${owned}`,
                        // The entry to take off the shelf the page came from.
                        shelfItemId: shelf
                            ? sql<string | null>`${myShelfEntries(me, shelf)}`
                            : sql<string | null>`null`,
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
