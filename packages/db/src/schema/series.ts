import { catalogItem } from './catalog-item.js';
import { externalSource, seriesKind } from './enums.js';
import { appSchema, id, timestamps } from './primitives.js';
import { relations } from 'drizzle-orm';
import { index, text, unique } from 'drizzle-orm/pg-core';

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
