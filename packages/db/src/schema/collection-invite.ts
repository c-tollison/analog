import { user } from './auth.js';
import { collection } from './collection.js';
import { appSchema, createdAt } from './primitives.js';
import { index, primaryKey, uuid } from 'drizzle-orm/pg-core';

// A pending invite to join a collection as an editor. Accepting adds a
// member row; accepting or declining deletes the invite.
export const collectionInvite = appSchema.table(
    'collection_invite',
    {
        collectionId: uuid('collection_id')
            .notNull()
            .references(() => collection.id, { onDelete: 'cascade' }),
        inviteeId: uuid('invitee_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        inviterId: uuid('inviter_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        createdAt: createdAt(),
    },
    (table) => [
        primaryKey({ columns: [table.collectionId, table.inviteeId] }),
        index('collection_invite_invitee_id_idx').on(table.inviteeId),
    ]
);
