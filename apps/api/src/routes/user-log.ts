import { and, asc, desc, eq, isNotNull, schema, sql } from '@analog/db';
import {
    LogRange,
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
import { isCompleted } from '../lib/progress.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { z } from 'zod';

// Someone's Log: what they want to read, are reading and have read. Mounted
// at /users/:username, in its own router so the users router's type doesn't
// get too deep for TypeScript. It follows the profile's visibility, and
// visitors only see checked items.

const { catalogItem, progress, readingGoal, series } = schema;

function isTimeZone(zone: string) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: zone });
        return true;
    } catch {
        return false;
    }
}

// The viewer's time zone, since a day, month and year start at a different
// moment for each of them.
const StatsQuerySchema = z.object({
    range: z.enum(LogRange).default(LogRange.ThirtyDays),
    tz: z
        .string()
        .max(64)
        .refine(isTimeZone, 'Unknown time zone')
        .default('UTC'),
});

function todayIn(tz: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    }).formatToParts(new Date());
    const part = (type: string) =>
        Number(parts.find((p) => p.type === type)?.value);
    return { year: part('year'), month: part('month'), day: part('day') };
}

type Today = ReturnType<typeof todayIn>;

// One bar per day, month or year. A bar's key is the to_char of its start.
const BAR_PATTERNS = {
    [LogRange.ThirtyDays]: 'YYYY-MM-DD',
    [LogRange.TwelveMonths]: 'YYYY-MM',
    [LogRange.AllTime]: 'YYYY',
} as const;

function isoDate(year: number, monthIndex: number, day: number) {
    return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

/** The first day the range counts, or null for all time. */
function rangeStart(range: LogRange, { year, month, day }: Today) {
    if (range === LogRange.ThirtyDays)
        return isoDate(year, month - 1, day - 29);
    if (range === LogRange.TwelveMonths) return isoDate(year, month - 12, 1);
    return null;
}

/** The keys of every bar in the range, oldest first, ending today. */
function barKeys(range: LogRange, today: Today, firstYear: number) {
    const { year, month, day } = today;
    if (range === LogRange.ThirtyDays) {
        return Array.from({ length: 30 }, (_, index) =>
            isoDate(year, month - 1, day - 29 + index)
        );
    }
    if (range === LogRange.TwelveMonths) {
        return Array.from({ length: 12 }, (_, index) =>
            isoDate(year, month - 12 + index, 1).slice(0, 7)
        );
    }
    return Array.from({ length: year - firstYear + 1 }, (_, index) =>
        String(firstYear + index)
    );
}

function inLog(userId: string, isMe: boolean, status: ProgressStatus) {
    return and(
        eq(progress.userId, userId),
        eq(progress.status, status),
        isMe ? undefined : visibleToVisitors()
    );
}

const userLog = new Hono<AppEnv>()
    // Want to read, grouped by series, most recently changed first.
    .get(
        '/want-to-read',
        schemaValidator('param', UsernameParamSchema),
        schemaValidator('query', PageQuerySchema),
        async (c) => {
            const { username } = c.req.valid('param');
            const { id, isMe } = await requireVisibleProfile(
                username,
                c.get('user').id
            );
            const groupKey = sql<string>`coalesce(${catalogItem.seriesId}, ${catalogItem.id})`;

            const page = await paginate(c.req.valid('query'), (limit, offset) =>
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
                    .where(inLog(id, isMe, ProgressStatus.Planned))
                    .groupBy(groupKey, series.id)
                    .orderBy(desc(sql`max(${progress.updatedAt})`), groupKey)
                    .limit(limit)
                    .offset(offset)
            );
            return c.json(page);
        }
    )
    // Each volume being read on its own, most recently changed first.
    .get(
        '/reading',
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
                        title: catalogItem.title,
                        coverUrl: catalogItem.coverUrl,
                        position: catalogItem.position,
                        seriesTitle: series.title,
                    })
                    .from(progress)
                    .innerJoin(
                        catalogItem,
                        eq(catalogItem.id, progress.catalogItemId)
                    )
                    .leftJoin(series, eq(series.id, catalogItem.seriesId))
                    .where(inLog(id, isMe, ProgressStatus.InProgress))
                    .orderBy(desc(progress.updatedAt), asc(catalogItem.id))
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
    // How many were read in the range and their average rating, the finishes
    // bar by bar, and this year's goal.
    .get(
        '/log/stats',
        schemaValidator('param', UsernameParamSchema),
        schemaValidator('query', StatsQuerySchema),
        async (c) => {
            const { username } = c.req.valid('param');
            const { range, tz } = c.req.valid('query');
            const { id, isMe } = await requireVisibleProfile(
                username,
                c.get('user').id
            );
            const today = todayIn(tz);
            const theirs = and(
                eq(progress.userId, id),
                isMe ? undefined : visibleToVisitors()
            );
            const finishedAt = sql`(${progress.completedAt} at time zone ${tz})`;
            const finishedThisYear = sql`${isCompleted} and extract(year from ${finishedAt}) = ${today.year}`;
            // All time also counts finishes with no date.
            const start = rangeStart(range, today);
            const inRange = start
                ? sql`${isCompleted} and ${finishedAt} >= ${start}::date`
                : isCompleted;
            const barKey = sql<string>`to_char(${finishedAt}, ${BAR_PATTERNS[range]})`;

            const [[counts], bars, [goal]] = await Promise.all([
                db()
                    .select({
                        read: sql<number>`(count(*) filter (where ${inRange}))::int`,
                        readThisYear: sql<number>`(count(*) filter (where ${finishedThisYear}))::int`,
                        ratingAverage: sql<
                            number | null
                        >`avg(case when ${inRange} then ${progress.rating} end)::real`,
                    })
                    .from(progress)
                    .innerJoin(
                        catalogItem,
                        eq(catalogItem.id, progress.catalogItemId)
                    )
                    .leftJoin(series, eq(series.id, catalogItem.seriesId))
                    .where(theirs),
                db()
                    .select({ key: barKey, count: sql<number>`count(*)::int` })
                    .from(progress)
                    .innerJoin(
                        catalogItem,
                        eq(catalogItem.id, progress.catalogItemId)
                    )
                    .leftJoin(series, eq(series.id, catalogItem.seriesId))
                    .where(
                        and(theirs, inRange, isNotNull(progress.completedAt))
                    )
                    // By position: the time zone is sent once per use, so
                    // Postgres can't match the two expressions.
                    .groupBy(sql`1`),
                db()
                    .select({ target: readingGoal.target })
                    .from(readingGoal)
                    .where(
                        and(
                            eq(readingGoal.userId, id),
                            eq(readingGoal.year, today.year)
                        )
                    ),
            ]);

            // All time starts at the year of the first finish.
            const firstYear = Math.min(
                today.year,
                ...bars.map((bar) => Number(bar.key))
            );
            const perBar = barKeys(range, today, firstYear).map((key) => ({
                key,
                count: bars.find((bar) => bar.key === key)?.count ?? 0,
            }));
            return c.json({
                range,
                year: today.year,
                read: counts?.read ?? 0,
                readThisYear: counts?.readThisYear ?? 0,
                ratingAverage: counts?.ratingAverage ?? null,
                perBar,
                goal: goal?.target ?? null,
            });
        }
    );

export default userLog;
