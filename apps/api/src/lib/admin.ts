import {
    alias,
    asc,
    type Column,
    desc,
    isNotNull,
    isNull,
    type SQL,
    schema,
    sql,
} from '@analog/db';
import { AddedSort, VerifiedFilter } from '@analog/types';

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

/** The columns to set when an admin verifies or unverifies a row. */
export function verifiedBy(verified: boolean, userId: string) {
    return verified
        ? { verifiedAt: new Date(), verifiedByUserId: userId }
        : { verifiedAt: null, verifiedByUserId: null };
}
