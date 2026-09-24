import { user } from './auth.js';
import { appSchema, bytea, updatedAt } from './primitives.js';
import { uuid } from 'drizzle-orm/pg-core';

// Kept out of `user` so user queries never load the image bytes.
export const userAvatar = appSchema.table('user_avatar', {
    userId: uuid('user_id')
        .primaryKey()
        .references(() => user.id, { onDelete: 'cascade' }),
    data: bytea('data').notNull(),
    updatedAt: updatedAt(),
});
