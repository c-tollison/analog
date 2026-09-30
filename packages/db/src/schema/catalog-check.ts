import { catalogItem } from './catalog-item.js';
import { checkRule } from './enums.js';
import { appSchema, createdAt, id } from './primitives.js';
import { series } from './series.js';
import { index, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// A problem `pnpm catalog:check` found with an item or a series, for an
// admin to review. Each run replaces the open rows for what it checked.
export const catalogCheck = appSchema.table(
    'catalog_check',
    {
        id: id(),
        catalogItemId: uuid('catalog_item_id').references(
            () => catalogItem.id,
            { onDelete: 'cascade' }
        ),
        seriesId: uuid('series_id').references(() => series.id, {
            onDelete: 'cascade',
        }),
        rule: checkRule('rule').notNull(),
        message: text('message').notNull(),
        // The new value when it's known: a title, a volume number, a series
        // id or an ISBN, depending on the rule.
        fix: text('fix'),
        // How sure Jev was, for rules it judges. Null for plain code rules.
        confidence: real('confidence'),
        // Set when an admin dismisses it. Later runs don't flag it again.
        dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
        createdAt: createdAt(),
    },
    (table) => [
        index('catalog_check_catalog_item_id_idx').on(table.catalogItemId),
        index('catalog_check_series_id_idx').on(table.seriesId),
    ]
);
