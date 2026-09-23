import { user } from './auth.js';
import { collectionItem } from './collection-item.js';
import { externalSource, mediaFormat, seriesKind } from './enums.js';
import { appSchema, id, timestamps } from './primitives.js';
import { series } from './series.js';
import { relations } from 'drizzle-orm';
import { date, index, jsonb, numeric, text, uuid } from 'drizzle-orm/pg-core';

// One physical product (what a barcode identifies), shared by all users.
export const catalogItem = appSchema.table(
    'catalog_item',
    {
        id: id(),
        format: mediaFormat('format').notNull(),
        kind: seriesKind('kind'),
        title: text('title').notNull(),
        seriesId: uuid('series_id').references(() => series.id, {
            onDelete: 'set null',
        }),
        // Volume or season number within the series.
        position: numeric('position', { mode: 'number' }),
        // ISBN-13 for books, UPC/EAN for discs.
        barcode: text('barcode').unique(),
        externalSource: externalSource('external_source'),
        externalId: text('external_id'),
        coverUrl: text('cover_url'),
        releaseDate: date('release_date'),
        metadata: jsonb('metadata')
            .$type<Record<string, unknown>>()
            .notNull()
            .default({}),
        createdByUserId: uuid('created_by_user_id').references(() => user.id, {
            onDelete: 'set null',
        }),
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
}));
