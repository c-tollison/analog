import { user } from './auth.js';
import { catalogItem } from './catalog-item.js';
import { progressStatus } from './enums.js';
import { appSchema, timestamps } from './primitives.js';
import { sql } from 'drizzle-orm';
import {
    check,
    index,
    primaryKey,
    smallint,
    text,
    timestamp,
    uuid,
} from 'drizzle-orm/pg-core';

// One person's status, rating and review for a catalog item. It follows the
// person across every collection the item is in. A null status keeps the
// review around when someone un-marks an item.
export const progress = appSchema.table(
    'progress',
    {
        userId: uuid('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        catalogItemId: uuid('catalog_item_id')
            .notNull()
            .references(() => catalogItem.id, { onDelete: 'cascade' }),
        status: progressStatus('status'),
        rating: smallint('rating'),
        review: text('review'),
        completedAt: timestamp('completed_at', { withTimezone: true }),
        ...timestamps(),
    },
    (table) => [
        primaryKey({ columns: [table.userId, table.catalogItemId] }),
        index('progress_catalog_item_id_idx').on(table.catalogItemId),
        check('progress_rating_range', sql`${table.rating} between 1 and 5`),
    ]
);
