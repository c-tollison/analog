import { catalogItemIsbn } from './catalog-item-isbn.js';
import { collectionItem } from './collection-item.js';
import { appSchema, createdAt } from './primitives.js';
import { relations } from 'drizzle-orm';
import { index, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

// The editions a collection entry owns, like both printings of one volume.
// An entry added from search owns none until someone picks one.
export const collectionItemIsbn = appSchema.table(
    'collection_item_isbn',
    {
        collectionItemId: uuid('collection_item_id')
            .notNull()
            .references(() => collectionItem.id, { onDelete: 'cascade' }),
        isbn: text('isbn')
            .notNull()
            .references(() => catalogItemIsbn.isbn, { onDelete: 'cascade' }),
        createdAt: createdAt(),
    },
    (table) => [
        primaryKey({ columns: [table.collectionItemId, table.isbn] }),
        index('collection_item_isbn_isbn_idx').on(table.isbn),
    ]
);

export const collectionItemIsbnRelations = relations(
    collectionItemIsbn,
    ({ one }) => ({
        collectionItem: one(collectionItem, {
            fields: [collectionItemIsbn.collectionItemId],
            references: [collectionItem.id],
        }),
    })
);
