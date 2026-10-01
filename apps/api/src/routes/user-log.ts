import { and, asc, desc, eq, schema, sql } from '@analog/db';
import {
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
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { z } from 'zod';

// Someone's Log: what they want to read, are reading and have read. Mounted
// at /users/:username, in its own router so the users router's type doesn't
// get too deep for TypeScript. It follows the profile's visibility, and
// visitors only see checked items.

const { catalogItem, progress, series } = schema;

const LogQuerySchema = PageQuerySchema.extend({
    status: z.enum([ProgressStatus.Planned, ProgressStatus.InProgress]),
});

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
    );

export default userLog;
