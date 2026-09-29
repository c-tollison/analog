import { eq, isNotNull, or, schema } from '@analog/db';

// What people can find in search and pick from lists. Until an admin
// verifies an item or series, only the person who added it can find it.
// Anyone can still reach an item by scanning its ISBN, and collections that
// have it show it as usual.

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
