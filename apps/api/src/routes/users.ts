import { and, asc, eq, ilike, ne, or, schema, sql } from '@analog/db';
import {
    PageQuerySchema,
    USER_SEARCH_MIN_LENGTH,
    USERNAME_MAX_LENGTH,
} from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { relationshipTo, userColumns } from '../lib/friends.js';
import { db } from '../lib/init.js';
import { likePattern, paginate } from '../lib/pagination.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const { user } = schema;

const SearchQuerySchema = PageQuerySchema.extend({
    q: z.string().trim().min(USER_SEARCH_MIN_LENGTH).max(100),
});
const UsernameParamSchema = z.object({
    username: z.string().trim().toLowerCase().min(1).max(USERNAME_MAX_LENGTH),
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
    );

export default users;
