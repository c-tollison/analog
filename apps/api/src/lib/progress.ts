import { type Column, schema, sql } from '@analog/db';
import { ProgressStatus } from '@analog/types';

// Ratings and reviews only count once the item is finished. Un-marking keeps
// them stored but hidden, so every read goes through these.
export const isCompleted = sql`${schema.progress.status} = ${ProgressStatus.Completed}`;

export function whenCompleted<T>(column: Column) {
    return sql<T | null>`case when ${isCompleted} then ${column} end`;
}
