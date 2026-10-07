import { catalogItem } from './catalog-item.js';
import { genre } from './genre.js';
import { appSchema } from './primitives.js';
import { relations } from 'drizzle-orm';
import { index, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

// A book's genres. A volume joining a series copies its siblings' genres.
export const catalogItemGenre = appSchema.table(
    'catalog_item_genre',
    {
        catalogItemId: uuid('catalog_item_id')
            .notNull()
            .references(() => catalogItem.id, { onDelete: 'cascade' }),
        genreSlug: text('genre_slug')
            .notNull()
            .references(() => genre.slug, {
                onDelete: 'cascade',
                onUpdate: 'cascade',
            }),
    },
    (table) => [
        primaryKey({ columns: [table.catalogItemId, table.genreSlug] }),
        index('catalog_item_genre_genre_slug_idx').on(table.genreSlug),
    ]
);

export const catalogItemGenreRelations = relations(
    catalogItemGenre,
    ({ one }) => ({
        catalogItem: one(catalogItem, {
            fields: [catalogItemGenre.catalogItemId],
            references: [catalogItem.id],
        }),
        genre: one(genre, {
            fields: [catalogItemGenre.genreSlug],
            references: [genre.slug],
        }),
    })
);
