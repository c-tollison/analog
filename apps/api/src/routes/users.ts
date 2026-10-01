import { and, asc, eq, ilike, inArray, ne, or, schema, sql } from '@analog/db';
import {
    GoalYearSchema,
    PageQuerySchema,
    ReadingGoalSchema,
    UpdatePreferencesSchema,
    USER_SEARCH_MIN_LENGTH,
} from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { toAvatar } from '../lib/avatar.js';
import { canSeeCollection, collectionSummaries } from '../lib/collections.js';
import {
    relationshipTo,
    requireVisibleProfile,
    userColumns,
} from '../lib/friends.js';
import { db } from '../lib/init.js';
import { likePattern, paginate } from '../lib/pagination.js';
import { IdParamSchema, UsernameParamSchema } from '../lib/params.js';
import { schemaValidator } from '../lib/validator.js';
import userLog from './user-log.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const { collection, collectionMember, readingGoal, user, userAvatar } = schema;

const YearParamSchema = z.object({ year: GoalYearSchema });
const SearchQuerySchema = PageQuerySchema.extend({
    q: z.string().trim().min(USER_SEARCH_MIN_LENGTH).max(100),
});
const AvatarFormSchema = z.object({
    file: z.instanceof(File, { message: 'Choose a photo' }),
});

const users = new Hono<AppEnv>()
    .route('/:username', userLog)
    .get('/', schemaValidator('query', SearchQuerySchema), async (c) => {
        const { q, ...pageQuery } = c.req.valid('query');
        const me = c.get('user').id;
        const handle = q.replace(/^@/, '').toLowerCase();
        const prefix = likePattern(handle, { anywhere: false });

        const page = await paginate(pageQuery, (limit, offset) =>
            db()
                .select({ ...userColumns, relationship: relationshipTo(me) })
                .from(user)
                .where(
                    and(
                        ne(user.id, me),
                        or(
                            ilike(user.username, prefix),
                            ilike(user.name, likePattern(q))
                        )
                    )
                )
                .orderBy(
                    sql`${user.username} = ${handle} desc`,
                    sql`${user.username} like ${prefix} desc`,
                    sql`lower(${user.name})`,
                    asc(user.id)
                )
                .limit(limit)
                .offset(offset)
        );
        return c.json(page);
    })
    .get(
        '/:username',
        schemaValidator('param', UsernameParamSchema),
        async (c) => {
            const { username } = c.req.valid('param');
            const [found] = await db()
                .select({
                    ...userColumns,
                    isPublic: user.isPublic,
                    relationship: relationshipTo(c.get('user').id),
                })
                .from(user)
                .where(eq(user.username, username));
            if (!found) {
                throw new HTTPException(404, { message: 'User not found' });
            }
            return c.json(found);
        }
    )
    .get(
        '/:username/collections',
        schemaValidator('param', UsernameParamSchema),
        schemaValidator('query', PageQuerySchema),
        async (c) => {
            const { username } = c.req.valid('param');
            const me = c.get('user').id;
            const found = await requireVisibleProfile(username, me);

            // Everything they're a member of that I'm allowed to see.
            const theirs = db()
                .select({ id: collectionMember.collectionId })
                .from(collectionMember)
                .where(eq(collectionMember.userId, found.id));
            const page = await paginate(c.req.valid('query'), (limit, offset) =>
                collectionSummaries(
                    me,
                    and(inArray(collection.id, theirs), canSeeCollection(me))
                )
                    .limit(limit)
                    .offset(offset)
            );
            return c.json(page);
        }
    )
    .put('/me/avatar', schemaValidator('form', AvatarFormSchema), async (c) => {
        const { file } = c.req.valid('form');
        const me = c.get('user').id;
        const data = await toAvatar(await file.arrayBuffer());
        // The version in the URL lets browsers cache each photo forever.
        const image = `/api/users/${me}/avatar?v=${Date.now()}`;

        await db().transaction(async (tx) => {
            await tx
                .insert(userAvatar)
                .values({ userId: me, data })
                .onConflictDoUpdate({
                    target: userAvatar.userId,
                    set: { data, updatedAt: new Date() },
                });
            await tx.update(user).set({ image }).where(eq(user.id, me));
        });
        return c.json({ image });
    })
    .delete('/me/avatar', async (c) => {
        const me = c.get('user').id;
        await db().transaction(async (tx) => {
            await tx.delete(userAvatar).where(eq(userAvatar.userId, me));
            await tx.update(user).set({ image: null }).where(eq(user.id, me));
        });
        return c.body(null, 204);
    })
    .patch(
        '/me/preferences',
        schemaValidator('json', UpdatePreferencesSchema),
        async (c) => {
            const values = c.req.valid('json');
            const me = c.get('user').id;
            await db().update(user).set(values).where(eq(user.id, me));
            return c.json(values);
        }
    )
    .put(
        '/me/goals/:year',
        schemaValidator('param', YearParamSchema),
        schemaValidator('json', ReadingGoalSchema),
        async (c) => {
            const { year } = c.req.valid('param');
            const { target } = c.req.valid('json');
            const me = c.get('user').id;
            await db()
                .insert(readingGoal)
                .values({ userId: me, year, target })
                .onConflictDoUpdate({
                    target: [readingGoal.userId, readingGoal.year],
                    set: { target, updatedAt: new Date() },
                });
            return c.json({ year, target });
        }
    )
    .delete(
        '/me/goals/:year',
        schemaValidator('param', YearParamSchema),
        async (c) => {
            const { year } = c.req.valid('param');
            await db()
                .delete(readingGoal)
                .where(
                    and(
                        eq(readingGoal.userId, c.get('user').id),
                        eq(readingGoal.year, year)
                    )
                );
            return c.body(null, 204);
        }
    )
    .get('/:id/avatar', schemaValidator('param', IdParamSchema), async (c) => {
        const { id } = c.req.valid('param');
        const [found] = await db()
            .select({ data: userAvatar.data })
            .from(userAvatar)
            .where(eq(userAvatar.userId, id));
        if (!found) {
            throw new HTTPException(404, { message: 'Photo not found' });
        }
        return c.body(new Uint8Array(found.data), 200, {
            'Content-Type': 'image/webp',
            'Cache-Control': 'private, max-age=31536000, immutable',
        });
    });

export default users;
