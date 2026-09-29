import { catalogItem } from './catalog-item.js';
import { appSchema, createdAt } from './primitives.js';
import { relations, sql } from 'drizzle-orm';
import { boolean, index, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// Every ISBN a book is sold under, like its paperback, ebook and
// translations. Scanning any of them finds the same catalog item. People
// add ISBNs by scanning; nothing links them automatically.
export const catalogItemIsbn = appSchema.table(
    'catalog_item_isbn',
    {
        isbn: text('isbn').primaryKey(),
        catalogItemId: uuid('catalog_item_id')
            .notNull()
            .references(() => catalogItem.id, { onDelete: 'cascade' }),
        // The ISBN the item's details came from, which refresh looks up
        // again. One per item.
        main: boolean('main').default(false).notNull(),
        title: text('title'),
        coverUrl: text('cover_url'),
        publisher: text('publisher'),
        // An ISO 639 code, like "en".
        language: text('language'),
        format: text('format'),
        // Joined an existing item from a scan, and an admin hasn't checked it.
        pending: boolean('pending').default(false).notNull(),
        createdAt: createdAt(),
    },
    (table) => [
        index('catalog_item_isbn_catalog_item_id_idx').on(table.catalogItemId),
        uniqueIndex('catalog_item_isbn_main_idx')
            .on(table.catalogItemId)
            .where(sql`${table.main}`),
    ]
);

export const catalogItemIsbnRelations = relations(
    catalogItemIsbn,
    ({ one }) => ({
        catalogItem: one(catalogItem, {
            fields: [catalogItemIsbn.catalogItemId],
            references: [catalogItem.id],
        }),
    })
);
