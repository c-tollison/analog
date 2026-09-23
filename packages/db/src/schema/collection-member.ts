import { user } from './auth.js';
import { collection } from './collection.js';
import { collectionRole } from './enums.js';
import { appSchema, createdAt } from './primitives.js';
import { relations } from 'drizzle-orm';
import { index, primaryKey, uuid } from 'drizzle-orm/pg-core';

// Who can see and edit a collection. The creator is an owner member.
export const collectionMember = appSchema.table(
    'collection_member',
    {
        collectionId: uuid('collection_id')
            .notNull()
            .references(() => collection.id, { onDelete: 'cascade' }),
        userId: uuid('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        role: collectionRole('role').notNull(),
        createdAt: createdAt(),
    },
    (table) => [
        primaryKey({ columns: [table.collectionId, table.userId] }),
        index('collection_member_user_id_idx').on(table.userId),
    ]
);

export const collectionMemberRelations = relations(
    collectionMember,
    ({ one }) => ({
        collection: one(collection, {
            fields: [collectionMember.collectionId],
            references: [collection.id],
        }),
        user: one(user, {
            fields: [collectionMember.userId],
            references: [user.id],
        }),
    })
);
