import { catalogItemGenre } from './catalog-item-genre.js';
import { appSchema } from './primitives.js';
import { relations } from 'drizzle-orm';
import { type AnyPgColumn, boolean, index, text } from 'drizzle-orm/pg-core';

// Genres, like "Cozy mystery" under "Mystery". Books have genres; a series
// shows the ones its volumes have. Seeded in migration 0030.
export const genre = appSchema.table(
    'genre',
    {
        // Like "cozy-mystery". Lookups map source genres to these.
        slug: text('slug').primaryKey(),
        name: text('name').notNull(),
        parentSlug: text('parent_slug').references(
            (): AnyPgColumn => genre.slug,
            { onDelete: 'set null' }
        ),
        nonfiction: boolean('nonfiction').default(false).notNull(),
    },
    (table) => [index('genre_parent_slug_idx').on(table.parentSlug)]
);

export const genreRelations = relations(genre, ({ one, many }) => ({
    parent: one(genre, {
        fields: [genre.parentSlug],
        references: [genre.slug],
        relationName: 'subgenres',
    }),
    subgenres: many(genre, { relationName: 'subgenres' }),
    catalogItems: many(catalogItemGenre),
}));
