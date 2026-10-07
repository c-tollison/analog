import { user } from './auth.js';
import { catalogItem } from './catalog-item.js';
import { audience, seriesKind } from './enums.js';
import { appSchema, id, timestamps } from './primitives.js';
import { relations } from 'drizzle-orm';
import { index, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Our own grouping record, e.g. "Haikyu!!", in every language.
export const series = appSchema.table(
    'series',
    {
        id: id(),
        title: text('title').notNull(),
        kind: seriesKind('kind').notNull(),
        coverUrl: text('cover_url'),
        // How many volumes this edition has in total. Set by people, since
        // omnibus editions don't match the original count.
        volumeCount: integer('volume_count'),
        // Shown on the series page.
        description: text('description'),
        // Who it's written for. Every volume shows it.
        audience: audience('audience'),
        // Until an admin verifies the series, only this person can find it.
        createdByUserId: uuid('created_by_user_id').references(() => user.id, {
            onDelete: 'set null',
        }),
        verifiedAt: timestamp('verified_at', { withTimezone: true }),
        verifiedByUserId: uuid('verified_by_user_id').references(
            () => user.id,
            { onDelete: 'set null' }
        ),
        ...timestamps(),
    },
    (table) => [
        index('series_title_trgm_idx').using(
            'gin',
            table.title.op('gin_trgm_ops')
        ),
    ]
);

export const seriesRelations = relations(series, ({ many }) => ({
    items: many(catalogItem),
}));
