import { and, asc, eq, ilike, ne, or, schema, sql } from '@analog/db';
import {
    PageQuerySchema,
    USER_SEARCH_MIN_LENGTH,
    USERNAME_MAX_LENGTH,
} from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { toAvatar } from '../lib/avatar.js';
import { relationshipTo, userColumns } from '../lib/friends.js';
import { db } from '../lib/init.js';
import { likePattern, paginate } from '../lib/pagination.js';
import { IdParamSchema } from '../lib/params.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const { user, userAvatar } = schema;

const SearchQuerySchema = PageQuerySchema.extend({
    q: z.string().trim().min(USER_SEARCH_MIN_LENGTH).max(100),
});
const UsernameParamSchema = z.object({
    username: z.string().trim().toLowerCase().min(1).max(USERNAME_MAX_LENGTH),
});
const AvatarFormSchema = z.object({
    file: z.instanceof(File, { message: 'Choose a photo' }),
});

const users = new Hono<AppEnv>()
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
