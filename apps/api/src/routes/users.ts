import { schema } from '@analog/db';
import { schemaValidator } from '@analog/server';
import { CreateUserRequestSchema } from '@analog/types';
import { Hono } from 'hono';

import { db } from '../lib/container.js';

const users = new Hono().post(
    '/',
    schemaValidator('json', CreateUserRequestSchema),
    async (c) => {
        const { name } = c.req.valid('json');

        const [user] = await db()
            .insert(schema.users)
            .values({ name })
            .returning();

        return c.json(user, 201);
    }
);

export default users;
