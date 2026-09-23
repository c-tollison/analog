import { user } from './auth.js';
import { appSchema, createdAt } from './primitives.js';
import { sql } from 'drizzle-orm';
import { check, index, primaryKey, uuid } from 'drizzle-orm/pg-core';

// One row per pair of friends, smaller id first so a pair can't be stored
// twice. `createdAt` is when the request was accepted.
export const friendship = appSchema.table(
    'friendship',
    {
        userAId: uuid('user_a_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        userBId: uuid('user_b_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        createdAt: createdAt(),
    },
    (table) => [
        primaryKey({ columns: [table.userAId, table.userBId] }),
        index('friendship_user_b_id_idx').on(table.userBId),
        check(
            'friendship_ordered_pair',
            sql`${table.userAId} < ${table.userBId}`
        ),
    ]
);
