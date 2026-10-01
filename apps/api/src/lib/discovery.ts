import { and, eq, isNotNull, isNull, or, schema } from '@analog/db';

// What people can find in search and pick from lists. Until an admin
// verifies an item or series, only the person who added it can find it.
// Anyone can still open its page by link or by scanning its ISBN, and
// collections that have it show it as usual.

export function discoverableItem(userId: string) {
    const { catalogItem } = schema;
    return or(
        isNotNull(catalogItem.verifiedAt),
        eq(catalogItem.createdByUserId, userId)
    );
}

export function discoverableSeries(userId: string) {
    const { series } = schema;
    return or(isNotNull(series.verifiedAt), eq(series.createdByUserId, userId));
}

/**
 * What people who aren't members see inside a collection: verified items,
 * and only if their series is verified too. Needs `series` left-joined on
 * the item's series.
 */
export function visibleToVisitors() {
    const { catalogItem, series } = schema;
    return and(
        isNotNull(catalogItem.verifiedAt),
        or(isNull(catalogItem.seriesId), isNotNull(series.verifiedAt))
    );
}
