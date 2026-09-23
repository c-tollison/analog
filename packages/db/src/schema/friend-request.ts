import { user } from './auth.js';
import { appSchema, createdAt } from './primitives.js';
import { index, primaryKey, uuid } from 'drizzle-orm/pg-core';

// A pending friend request. Accepting, declining or cancelling deletes it.
export const friendRequest = appSchema.table(
    'friend_request',
    {
        senderId: uuid('sender_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        recipientId: uuid('recipient_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        createdAt: createdAt(),
    },
    (table) => [
        primaryKey({ columns: [table.senderId, table.recipientId] }),
        index('friend_request_recipient_id_idx').on(table.recipientId),
    ]
);
