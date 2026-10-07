import { user } from './auth.js';
import { catalogItemGenre } from './catalog-item-genre.js';
import { catalogItemIsbn } from './catalog-item-isbn.js';
import { catalogItemPerson } from './catalog-item-person.js';
import { collectionItem } from './collection-item.js';
import { audience, externalSource, seriesKind } from './enums.js';
import { appSchema, id, timestamps } from './primitives.js';
import { series } from './series.js';
import { relations } from 'drizzle-orm';
import {
    index,
    integer,
    numeric,
    real,
    text,
    timestamp,
    uuid,
} from 'drizzle-orm/pg-core';

// One book, shared by all users. Its ISBNs are in catalog_item_isbn.
export const catalogItem = appSchema.table(
    'catalog_item',
    {
        id: id(),
        kind: seriesKind('kind'),
        title: text('title').notNull(),
        seriesId: uuid('series_id').references(() => series.id, {
            onDelete: 'set null',
        }),
        // Volume number within the series.
        position: numeric('position', { mode: 'number' }),
        externalSource: externalSource('external_source'),
        externalId: text('external_id'),
        coverUrl: text('cover_url'),
        subtitle: text('subtitle'),
        description: text('description'),
        firstPublishedYear: integer('first_published_year'),
        // Who it's written for. Volumes in a series show the series' instead.
        audience: audience('audience'),
        // When each source last answered for this book. Null means it hasn't,
        // so the book is looked up there again.
        googleBooksFetchedAt: timestamp('google_books_fetched_at', {
            withTimezone: true,
        }),
        openLibraryFetchedAt: timestamp('open_library_fetched_at', {
            withTimezone: true,
        }),
        createdByUserId: uuid('created_by_user_id').references(() => user.id, {
            onDelete: 'set null',
        }),
        // Set when an admin has checked the item. Lookups never change a
        // verified item, only hand edits do.
        verifiedAt: timestamp('verified_at', { withTimezone: true }),
        verifiedByUserId: uuid('verified_by_user_id').references(
            () => user.id,
            { onDelete: 'set null' }
        ),
        // Counted from progress by refreshItemStats. Saves are people with
        // any status. Ratings only count once finished, out of 10.
        saveCount: integer('save_count').default(0).notNull(),
        ratingCount: integer('rating_count').default(0).notNull(),
        ratingAverage: real('rating_average'),
        ...timestamps(),
    },
    (table) => [
        index('catalog_item_series_id_idx').on(table.seriesId),
        index('catalog_item_title_trgm_idx').using(
            'gin',
            table.title.op('gin_trgm_ops')
        ),
    ]
);

export const catalogItemRelations = relations(catalogItem, ({ one, many }) => ({
    series: one(series, {
        fields: [catalogItem.seriesId],
        references: [series.id],
    }),
    collectionItems: many(collectionItem),
    isbns: many(catalogItemIsbn),
    people: many(catalogItemPerson),
    genres: many(catalogItemGenre),
}));
