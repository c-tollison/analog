import { user } from './auth.js';
import { appSchema, timestamps } from './primitives.js';
import { integer, primaryKey, uuid } from 'drizzle-orm/pg-core';

// How many items someone wants to finish in a year. Every volume counts as
// one.
export const readingGoal = appSchema.table(
    'reading_goal',
    {
        userId: uuid('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        year: integer('year').notNull(),
        target: integer('target').notNull(),
        ...timestamps(),
    },
    (table) => [primaryKey({ columns: [table.userId, table.year] })]
);
