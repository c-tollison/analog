import { catalogItemIsbn } from './catalog-item-isbn.js';
import { appSchema, bytea, updatedAt } from './primitives.js';
import { text } from 'drizzle-orm/pg-core';

// A cover an admin uploaded for an edition. Book lookups never replace it.
// Kept out of `catalog_item_isbn` so its queries never load the image bytes.
export const catalogItemIsbnCover = appSchema.table('catalog_item_isbn_cover', {
    isbn: text('isbn')
        .primaryKey()
        .references(() => catalogItemIsbn.isbn, { onDelete: 'cascade' }),
    data: bytea('data').notNull(),
    updatedAt: updatedAt(),
});
