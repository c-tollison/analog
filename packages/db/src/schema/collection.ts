import { collectionItem } from './collection-item.js';
import { collectionMember } from './collection-member.js';
import { appSchema, id, timestamps } from './primitives.js';
import { relations } from 'drizzle-orm';
import { boolean, text } from 'drizzle-orm/pg-core';

// A named, shareable group of items, e.g. "Manga" or "Our DVDs".
export const collection = appSchema.table('collection', {
    id: id(),
    name: text('name').notNull(),
    // Private collections are for members only. Public ones follow the
    // owner's profile: anyone if it's public, friends if it's private.
    isPublic: boolean('is_public').default(true).notNull(),
    ...timestamps(),
});

export const collectionRelations = relations(collection, ({ many }) => ({
    members: many(collectionMember),
    items: many(collectionItem),
}));
