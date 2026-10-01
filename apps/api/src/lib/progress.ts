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
 * anything changes an item's progress. It locks the item's row first, so two
 * recounts at once run one after the other, and the last one sees every
 * change.
 */
export async function refreshItemStats(
    catalogItemId: string,
    tx?: Transaction
): Promise<void> {
    if (!tx) {
        await db().transaction((own) => refreshItemStats(catalogItemId, own));
        return;
    }
    const { catalogItem, progress } = schema;
    const [locked] = await tx
        .select({ id: catalogItem.id })
        .from(catalogItem)
        .where(eq(catalogItem.id, catalogItemId))
        .for('update');
    if (!locked) {
        return;
    }
    const [stats] = await tx
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
    await tx
        .update(catalogItem)
        .set(stats)
        .where(eq(catalogItem.id, catalogItemId));
}
