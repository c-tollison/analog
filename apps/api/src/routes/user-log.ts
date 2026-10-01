import { and, asc, desc, eq, schema, sql } from '@analog/db';
import {
    GoalYearSchema,
    type MediaFormat,
    PageQuerySchema,
    ProgressStatus,
} from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { lowestVolumeCover, seriesColumns } from '../lib/books.js';
import { visibleToVisitors } from '../lib/discovery.js';
import { requireVisibleProfile } from '../lib/friends.js';
import { db } from '../lib/init.js';
import { paginate } from '../lib/pagination.js';
import { UsernameParamSchema } from '../lib/params.js';
import { isCompleted, whenCompleted } from '../lib/progress.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { z } from 'zod';

// Someone's Log: what they want to read, are reading and have read. Mounted
// at /users/:username, in its own router so the users router's type doesn't
// get too deep for TypeScript. It follows the profile's visibility, and
// visitors only see checked items.

const { catalogItem, progress, readingGoal, series } = schema;

const LogQuerySchema = PageQuerySchema.extend({
    status: z.enum([ProgressStatus.Planned, ProgressStatus.InProgress]),
});
function isTimeZone(zone: string) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: zone });
        return true;
    } catch {
        return false;
    }
}

// The viewer's own year and time zone, since a year and its months start at
// a different moment for each of them.
const StatsQuerySchema = z.object({
    year: GoalYearSchema,
    tz: z
        .string()
        .max(64)
        .refine(isTimeZone, 'Unknown time zone')
        .default('UTC'),
});

function statusCount(status: ProgressStatus) {
    return sql<number>`(count(*) filter (where ${progress.status} = ${status}))::int`;
}

function inLog(userId: string, isMe: boolean, status: ProgressStatus) {
    return and(
        eq(progress.userId, userId),
        eq(progress.status, status),
        isMe ? undefined : visibleToVisitors()
    );
}

const userLog = new Hono<AppEnv>()
    // Want to read or Reading, grouped by series, most recently changed first.
    .get(
        '/log',
        schemaValidator('param', UsernameParamSchema),
        schemaValidator('query', LogQuerySchema),
        async (c) => {
            const { username } = c.req.valid('param');
            const { status, ...pageQuery } = c.req.valid('query');
            const { id, isMe } = await requireVisibleProfile(
                username,
                c.get('user').id
            );
            const groupKey = sql<string>`coalesce(${catalogItem.seriesId}, ${catalogItem.id})`;

            const page = await paginate(pageQuery, (limit, offset) =>
                db()
                    .select({
                        series: seriesColumns,
                        count: sql<number>`count(*)::int`,
                        // The rest are only meaningful for items not in a
                        // series.
                        id: sql<string>`min(${catalogItem.id}::text)`,
                        format: sql<MediaFormat>`min(${catalogItem.format}::text)`,
                        title: sql<string>`min(${catalogItem.title})`,
                        coverUrl: lowestVolumeCover,
                    })
                    .from(progress)
                    .innerJoin(
                        catalogItem,
                        eq(catalogItem.id, progress.catalogItemId)
                    )
                    .leftJoin(series, eq(series.id, catalogItem.seriesId))
                    .where(inLog(id, isMe, status))
                    .groupBy(groupKey, series.id)
                    .orderBy(desc(sql`max(${progress.updatedAt})`), groupKey)
                    .limit(limit)
                    .offset(offset)
            );
            return c.json(page);
        }
    )
    // Everything read, newest finished first, like a diary.
    .get(
        '/diary',
        schemaValidator('param', UsernameParamSchema),
        schemaValidator('query', PageQuerySchema),
        async (c) => {
            const { username } = c.req.valid('param');
            const { id, isMe } = await requireVisibleProfile(
                username,
                c.get('user').id
            );

            const page = await paginate(c.req.valid('query'), (limit, offset) =>
                db()
                    .select({
                        id: catalogItem.id,
                        format: catalogItem.format,
                        title: catalogItem.title,
                        coverUrl: catalogItem.coverUrl,
                        position: catalogItem.position,
                        seriesTitle: series.title,
                        rating: progress.rating,
                        completedAt: progress.completedAt,
                    })
                    .from(progress)
                    .innerJoin(
                        catalogItem,
                        eq(catalogItem.id, progress.catalogItemId)
                    )
                    .leftJoin(series, eq(series.id, catalogItem.seriesId))
                    .where(inLog(id, isMe, ProgressStatus.Completed))
                    .orderBy(
                        sql`${progress.completedAt} desc nulls last`,
                        desc(progress.updatedAt),
                        asc(catalogItem.id)
                    )
                    .limit(limit)
                    .offset(offset)
            );
            return c.json(page);
        }
    )
    // Totals for the top of the Log, the year's finishes by month, and the
    // year's goal.
    .get(
        '/log/stats',
        schemaValidator('param', UsernameParamSchema),
        schemaValidator('query', StatsQuerySchema),
        async (c) => {
            const { username } = c.req.valid('param');
            const { year, tz } = c.req.valid('query');
            const { id, isMe } = await requireVisibleProfile(
                username,
                c.get('user').id
            );
            const theirs = and(
                eq(progress.userId, id),
                isMe ? undefined : visibleToVisitors()
            );
            const finishedAt = sql`(${progress.completedAt} at time zone ${tz})`;
            const finishedThisYear = sql`${isCompleted} and extract(year from ${finishedAt}) = ${year}`;
            const month = sql<number>`extract(month from ${finishedAt})::int`;

            const [[counts], months, [goal]] = await Promise.all([
                db()
                    .select({
                        readThisYear: sql<number>`(count(*) filter (where ${finishedThisYear}))::int`,
                        readAllTime: statusCount(ProgressStatus.Completed),
                        reading: statusCount(ProgressStatus.InProgress),
                        wantToRead: statusCount(ProgressStatus.Planned),
                        ratingAverage: sql<
                            number | null
                        >`avg(${whenCompleted(progress.rating)})::real`,
                    })
                    .from(progress)
                    .innerJoin(
                        catalogItem,
                        eq(catalogItem.id, progress.catalogItemId)
                    )
                    .leftJoin(series, eq(series.id, catalogItem.seriesId))
                    .where(theirs),
                db()
                    .select({ month, count: sql<number>`count(*)::int` })
                    .from(progress)
                    .innerJoin(
                        catalogItem,
                        eq(catalogItem.id, progress.catalogItemId)
                    )
                    .leftJoin(series, eq(series.id, catalogItem.seriesId))
                    .where(and(theirs, finishedThisYear))
                    // By position: the time zone is sent once per use, so
                    // Postgres can't match the two month expressions.
                    .groupBy(sql`1`),
                db()
                    .select({ target: readingGoal.target })
                    .from(readingGoal)
                    .where(
                        and(
                            eq(readingGoal.userId, id),
                            eq(readingGoal.year, year)
                        )
                    ),
            ]);

            // Finishes in January through December, zero when none.
            const perMonth = Array.from(
                { length: 12 },
                (_, index) =>
                    months.find((row) => row.month === index + 1)?.count ?? 0
            );
            return c.json({
                year,
                readThisYear: counts?.readThisYear ?? 0,
                readAllTime: counts?.readAllTime ?? 0,
                reading: counts?.reading ?? 0,
                wantToRead: counts?.wantToRead ?? 0,
                ratingAverage: counts?.ratingAverage ?? null,
                perMonth,
                goal: goal?.target ?? null,
            });
        }
    );

export default userLog;
