import { type Column, eq, schema, sql } from '@analog/db';
import { ProgressStatus } from '@analog/types';

import type { Transaction } from './books.js';
import { db } from './init.js';

// Ratings and reviews only count once the item is finished. Un-marking keeps
// them stored but hidden, so every read goes through these.
export const isCompleted = sql`${schema.progress.status} = ${ProgressStatus.Completed}`;

export function whenCompleted<T>(column: Column) {
    return sql<T | null>`case when ${isCompleted} then ${column} end`;
}

/**
 * Recounts an item's saves and ratings from everyone's progress. Run it after
 * anything changes an item's progress, so the counts can't drift.
 */
export async function refreshItemStats(
    catalogItemId: string,
    executor: Pick<Transaction, 'select' | 'update'> = db()
): Promise<void> {
    const { catalogItem, progress } = schema;
    const [stats] = await executor
        .select({
            saveCount: sql<number>`count(${progress.status})::int`,
            ratingCount: sql<number>`count(${whenCompleted(progress.rating)})::int`,
            ratingAverage: sql<
                number | null
            >`avg(${whenCompleted(progress.rating)})::real`,
        })
        .from(progress)
        .where(eq(progress.catalogItemId, catalogItemId));
    if (!stats) {
        return;
    }
    await executor
        .update(catalogItem)
        .set(stats)
        .where(eq(catalogItem.id, catalogItemId));
}
