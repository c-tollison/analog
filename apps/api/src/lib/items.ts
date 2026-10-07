import {
    and,
    asc,
    eq,
    exists,
    inArray,
    isNotNull,
    ne,
    or,
    schema,
} from '@analog/db';

import { withGenres, withPeople } from './book-values.js';
import { db } from './init.js';
import { isCompleted } from './progress.js';
import { HTTPException } from 'hono/http-exception';

/**
 * A person's shelves that hold an item: one row per shelf and edition it
 * owns, by shelf name.
 */
export function shelvesHolding(catalogItemId: string, userId: string) {
    const { collection, collectionItem, collectionItemIsbn, collectionMember } =
        schema;
    return db()
        .select({
            id: collection.id,
            name: collection.name,
            isbn: collectionItemIsbn.isbn,
        })
        .from(collectionItem)
        .innerJoin(collection, eq(collection.id, collectionItem.collectionId))
        .innerJoin(
            collectionMember,
            and(
                eq(collectionMember.collectionId, collection.id),
                eq(collectionMember.userId, userId)
            )
        )
        .innerJoin(
            collectionItemIsbn,
            eq(collectionItemIsbn.collectionItemId, collectionItem.id)
        )
        .where(eq(collectionItem.catalogItemId, catalogItemId))
        .orderBy(
            asc(collection.name),
            asc(collection.id),
            asc(collectionItemIsbn.createdAt)
        );
}

/**
 * An item and the person's shelves that hold it, or a 404. Anyone with the
 * link can open an item's page, like after scanning its ISBN. Search and
 * other people's shelves are where unchecked items stay hidden.
 */
export async function requireItem(id: string, userId: string) {
    const { catalogItem } = schema;
    const [item, shelves] = await Promise.all([
        db().query.catalogItem.findFirst({
            where: eq(catalogItem.id, id),
            with: { series: true, ...withPeople, ...withGenres },
        }),
        shelvesHolding(id, userId),
    ]);
    if (!item) {
        throw new HTTPException(404, { message: 'Book not found' });
    }
    return { item, shelves };
}

/**
 * Editions people can see: checked ones, and unchecked ones they own. Pass
 * the ISBNs the person owns of this item.
 */
export function visibleEditions(ownedIsbns: string[]) {
    const { catalogItemIsbn } = schema;
    return ownedIsbns.length
        ? or(
              eq(catalogItemIsbn.pending, false),
              inArray(catalogItemIsbn.isbn, ownedIsbns)
          )
        : eq(catalogItemIsbn.pending, false);
}

/**
 * Everyone else who finished an item and left a rating or review. Items are
 * shared, so reviews are too.
 */
export function othersReviewed(catalogItemId: string, me: string) {
    const { progress } = schema;
    return and(
        eq(progress.catalogItemId, catalogItemId),
        ne(progress.userId, me),
        isCompleted,
        or(isNotNull(progress.rating), isNotNull(progress.review))
    );
}

/**
 * The person's shelf entries for the item in the outer query, on any of
 * their shelves or only on `shelfId`. The outer query must join another
 * table, so its columns keep their table names.
 */
export function myShelfEntries(userId: string, shelfId?: string) {
    const { catalogItem, collectionItem, collectionMember } = schema;
    return db()
        .select({ id: collectionItem.id })
        .from(collectionItem)
        .innerJoin(
            collectionMember,
            and(
                eq(collectionMember.collectionId, collectionItem.collectionId),
                eq(collectionMember.userId, userId)
            )
        )
        .where(
            and(
                eq(collectionItem.catalogItemId, catalogItem.id),
                shelfId ? eq(collectionItem.collectionId, shelfId) : undefined
            )
        );
}

/**
 * True when the item in the outer query is on one of the person's shelves,
 * or on `shelfId` when given. The outer query must join another table, so
 * its columns keep their table names.
 */
export function onShelfOf(userId: string, shelfId?: string) {
    return exists(myShelfEntries(userId, shelfId));
}
