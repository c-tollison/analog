import { user } from './auth.js';
import { catalogItem } from './catalog-item.js';
import { collection } from './collection.js';
import { appSchema, id, timestamps } from './primitives.js';
import { relations } from 'drizzle-orm';
import { index, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

// A catalog item placed in a collection.
export const collectionItem = appSchema.table(
    'collection_item',
    {
        id: id(),
        collectionId: uuid('collection_id')
            .notNull()
            .references(() => collection.id, { onDelete: 'cascade' }),
        catalogItemId: uuid('catalog_item_id')
            .notNull()
            .references(() => catalogItem.id, { onDelete: 'cascade' }),
        addedByUserId: uuid('added_by_user_id').references(() => user.id, {
            onDelete: 'set null',
        }),
        notes: text('notes'),
        acquiredAt: timestamp('acquired_at', { withTimezone: true }),
        ...timestamps(),
    },
    (table) => [
        unique('collection_item_collection_catalog_unique').on(
            table.collectionId,
            table.catalogItemId
        ),
        index('collection_item_catalog_item_id_idx').on(table.catalogItemId),
    ]
);

export const collectionItemRelations = relations(collectionItem, ({ one }) => ({
    collection: one(collection, {
        fields: [collectionItem.collectionId],
        references: [collection.id],
    }),
    catalogItem: one(catalogItem, {
        fields: [collectionItem.catalogItemId],
        references: [catalogItem.id],
    }),
}));
