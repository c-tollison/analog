import { catalogItem } from './catalog-item.js';
import { checkTrigger } from './enums.js';
import { appSchema, createdAt, id } from './primitives.js';
import { series } from './series.js';
import { index, integer, text, uuid } from 'drizzle-orm/pg-core';

// One Jev check of a book or series, for the admin history: what started
// it, what it cost in TypeSafe tokens, and what it found.
export const catalogCheckRun = appSchema.table(
    'catalog_check_run',
    {
        id: id(),
        trigger: checkTrigger('trigger').notNull(),
        catalogItemId: uuid('catalog_item_id').references(
            () => catalogItem.id,
            { onDelete: 'set null' }
        ),
        seriesId: uuid('series_id').references(() => series.id, {
            onDelete: 'set null',
        }),
        // The book or series title at the time, kept if it's deleted.
        title: text('title').notNull(),
        requests: integer('requests').notNull().default(0),
        inputTokens: integer('input_tokens').notNull().default(0),
        outputTokens: integer('output_tokens').notNull().default(0),
        problems: integer('problems').notNull().default(0),
        durationMs: integer('duration_ms').notNull(),
        error: text('error'),
        createdAt: createdAt(),
    },
    (table) => [index('catalog_check_run_created_at_idx').on(table.createdAt)]
);
