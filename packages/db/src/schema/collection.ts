import { collectionItem } from './collection-item.js';
import { collectionMember } from './collection-member.js';
import { appSchema, id, timestamps } from './primitives.js';
import { relations } from 'drizzle-orm';
import { text } from 'drizzle-orm/pg-core';

// A named, shareable group of items, e.g. "Manga" or "Our DVDs".
export const collection = appSchema.table('collection', {
    id: id(),
    name: text('name').notNull(),
    ...timestamps(),
});

export const collectionRelations = relations(collection, ({ many }) => ({
    members: many(collectionMember),
    items: many(collectionItem),
}));
