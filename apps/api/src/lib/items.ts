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

import { db } from './init.js';
import { isCompleted } from './progress.js';
import { HTTPException } from 'hono/http-exception';

/** A person's shelves that hold an item, with the editions each one owns. */
export async function shelvesHolding(catalogItemId: string, userId: string) {
    const { collection, collectionItem, collectionItemIsbn, collectionMember } =
        schema;
    const rows = await db()
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

    const shelves: { id: string; name: string; isbns: string[] }[] = [];
    for (const row of rows) {
        const shelf = shelves.find((found) => found.id === row.id);
        if (shelf) {
            shelf.isbns.push(row.isbn);
        } else {
            shelves.push({ id: row.id, name: row.name, isbns: [row.isbn] });
        }
    }
    return shelves;
}

/**
 * An item and the person's shelves that hold it, or a 404. People see
 * verified items in verified series, items they added, and items on their
 * shelves.
 */
export async function requireVisibleItem(id: string, userId: string) {
    const { catalogItem } = schema;
    const [item, shelves] = await Promise.all([
        db().query.catalogItem.findFirst({
            where: eq(catalogItem.id, id),
            with: { series: true },
        }),
        shelvesHolding(id, userId),
    ]);
    const isVerified =
        !!item?.verifiedAt && (!item.series || !!item.series.verifiedAt);
    if (
        !item ||
        !(isVerified || item.createdByUserId === userId || shelves.length)
    ) {
        throw new HTTPException(404, { message: 'Item not found' });
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
 * True when the item in the outer query is on one of the person's shelves.
 * The outer query must join another table, so its columns keep their table
 * names.
 */
export function onShelfOf(userId: string) {
    const { catalogItem, collectionItem, collectionMember } = schema;
    return exists(
        db()
            .select({ id: collectionItem.id })
            .from(collectionItem)
            .innerJoin(
                collectionMember,
                and(
                    eq(
                        collectionMember.collectionId,
                        collectionItem.collectionId
                    ),
                    eq(collectionMember.userId, userId)
                )
            )
            .where(eq(collectionItem.catalogItemId, catalogItem.id))
    );
}
