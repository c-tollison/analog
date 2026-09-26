import {
    alias,
    asc,
    type Column,
    desc,
    eq,
    isNotNull,
    isNull,
    type SQL,
    schema,
    sql,
} from '@analog/db';
import { AddedSort, VerifiedFilter } from '@analog/types';

import { db } from './init.js';

export const totalCount = sql<number>`count(*)::int`;

// The users who added and verified a row, for joining both at once.
export const addedByUser = alias(schema.user, 'added_by_user');
export const verifiedByUser = alias(schema.user, 'verified_by_user');

/** Rows matching the verified filter, by their `verified_at` column. */
export function whereVerified(
    verifiedAt: Column,
    status: VerifiedFilter
): SQL | undefined {
    if (status === VerifiedFilter.Verified) return isNotNull(verifiedAt);
    if (status === VerifiedFilter.Unverified) return isNull(verifiedAt);
    return undefined;
}

export function byAdded(createdAt: Column, sort: AddedSort): SQL {
    return sort === AddedSort.Oldest ? asc(createdAt) : desc(createdAt);
}

/**
 * The columns to set on a verified row: verified by this user now, or not
 * verified when there's no user.
 */
export function verifiedColumns(byUserId: string | null) {
    return byUserId
        ? { verifiedAt: new Date(), verifiedByUserId: byUserId }
        : { verifiedAt: null, verifiedByUserId: null };
}

/** Verifies or unverifies an item or series. False when there's no such row. */
export async function setVerified(
    table: typeof schema.catalogItem | typeof schema.series,
    id: string,
    byUserId: string | null
): Promise<boolean> {
    const [updated] = await db()
        .update(table)
        .set(verifiedColumns(byUserId))
        .where(eq(table.id, id))
        .returning({ id: table.id });
    return updated !== undefined;
}
