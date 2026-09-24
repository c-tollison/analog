import { catalogItem } from './catalog-item.js';
import { externalSource, seriesKind } from './enums.js';
import { appSchema, id, timestamps } from './primitives.js';
import { relations } from 'drizzle-orm';
import {
    index,
    integer,
    jsonb,
    text,
    timestamp,
    unique,
} from 'drizzle-orm/pg-core';

// Our own grouping record, e.g. "Haikyu!! (English)". External ids are
// optional links (e.g. a TMDB show)
export const series = appSchema.table(
    'series',
    {
        id: id(),
        title: text('title').notNull(),
        kind: seriesKind('kind').notNull(),
        coverUrl: text('cover_url'),
        externalSource: externalSource('external_source'),
        externalId: text('external_id'),
        // Where the synopsis, genres and run come from, e.g. an AniList
        // entry. Unlike the external id above, many series can share one:
        // a 3-in-1 edition and the singles both point at the same manga.
        detailsSource: externalSource('details_source'),
        detailsId: text('details_id'),
        details: jsonb('details')
            .$type<Record<string, unknown>>()
            .notNull()
            .default({}),
        detailsFetchedAt: timestamp('details_fetched_at', {
            withTimezone: true,
        }),
        // How many volumes this edition has in total. Set by people, since
        // omnibus editions don't match the original count.
        volumeCount: integer('volume_count'),
        ...timestamps(),
    },
    (table) => [
        unique('series_external_unique').on(
            table.externalSource,
            table.externalId
        ),
        index('series_title_trgm_idx').using(
            'gin',
            table.title.op('gin_trgm_ops')
        ),
    ]
);

export const seriesRelations = relations(series, ({ many }) => ({
    items: many(catalogItem),
}));
