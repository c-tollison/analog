import {
    and,
    asc,
    desc,
    eq,
    isNotNull,
    isNull,
    ne,
    or,
    schema,
    sql,
} from '@analog/db';
import { IsbnSchema, OwnedIsbnSchema, PageQuerySchema } from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { itemDetails } from '../lib/books.js';
import { requireMember } from '../lib/collections.js';
import { addEdition } from '../lib/editions.js';
import { userColumns } from '../lib/friends.js';
import { db } from '../lib/init.js';
import { paginate } from '../lib/pagination.js';
import { IdParamSchema } from '../lib/params.js';
import { isCompleted } from '../lib/progress.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

// One item in a collection: its page, editions and reviews. Mounted at
// /collections/:id/items, in its own router so neither router's type gets
// too deep for TypeScript.

const { catalogItemIsbn, collectionItem, collectionItemIsbn, progress, user } =
    schema;

const ItemParamSchema = IdParamSchema.extend({
    itemId: z.uuid('Invalid id'),
});
const EntryIsbnParamSchema = ItemParamSchema.extend({ isbn: IsbnSchema });

/**
 * Everyone else on the app who finished a catalog item and left a rating or
 * review. Items are shared, so reviews are too.
 */
function othersReviewed(catalogItemId: string, me: string) {
    return and(
        eq(progress.catalogItemId, catalogItemId),
        ne(progress.userId, me),
        isCompleted,
        or(isNotNull(progress.rating), isNotNull(progress.review))
    );
}

// The catalog item behind a collection entry, or a 404.
async function requireEntry(collectionId: string, itemId: string) {
    const found = await db().query.collectionItem.findFirst({
        columns: { catalogItemId: true },
        where: and(
            eq(collectionItem.id, itemId),
            eq(collectionItem.collectionId, collectionId)
        ),
    });
    if (!found) {
        throw new HTTPException(404, { message: 'Item not found' });
    }
    return found;
}

const collectionItems = new Hono<AppEnv>()
    .get('/:itemId', schemaValidator('param', ItemParamSchema), async (c) => {
        const { id, itemId } = c.req.valid('param');
        const me = c.get('user').id;
        await requireMember(id, me);

        const found = await db().query.collectionItem.findFirst({
            columns: { id: true },
            where: and(
                eq(collectionItem.id, itemId),
                eq(collectionItem.collectionId, id)
            ),
            with: {
                ownedIsbns: {
                    columns: { isbn: true },
                    orderBy: (row, { asc }) => [asc(row.createdAt)],
                },
                catalogItem: {
                    with: {
                        series: true,
                        isbns: {
                            columns: {
                                isbn: true,
                                title: true,
                                coverUrl: true,
                                publisher: true,
                                language: true,
                                format: true,
                                main: true,
                                pending: true,
                            },
                            orderBy: (row, { asc }) => [
                                asc(row.createdAt),
                                asc(row.isbn),
                            ],
                        },
                    },
                },
            },
        });
        if (!found) {
            throw new HTTPException(404, { message: 'Item not found' });
        }
        const item = found.catalogItem;
        const ownedIsbns = found.ownedIsbns.map((row) => row.isbn);
        // The page shows the first edition added, or the item's main one.
        const edition =
            item.isbns.find((row) => row.isbn === ownedIsbns[0]) ??
            item.isbns.find((row) => row.main) ??
            null;
        // ISBNs an admin hasn't checked stay hidden, except owned ones.
        const editions = item.isbns.filter(
            (row) => !row.pending || ownedIsbns.includes(row.isbn)
        );

        const details = itemDetails(item, edition);
        const [[mine], [counted]] = await Promise.all([
            db()
                .select({
                    status: progress.status,
                    rating: progress.rating,
                    review: progress.review,
                })
                .from(progress)
                .where(
                    and(
                        eq(progress.userId, me),
                        eq(progress.catalogItemId, item.id)
                    )
                ),
            db()
                .select({ reviewCount: sql<number>`count(*)::int` })
                .from(progress)
                .where(othersReviewed(item.id, me)),
        ]);

        return c.json({
            id: found.id,
            catalogItemId: item.id,
            format: item.format,
            kind: item.kind,
            title: edition?.title ?? item.title,
            coverUrl: edition?.coverUrl ?? item.coverUrl,
            position: item.position,
            seriesId: item.series?.id ?? null,
            seriesTitle: item.series?.title ?? null,
            ...details,
            ownedIsbns,
            editions,
            status: mine?.status ?? null,
            rating: mine?.rating ?? null,
            review: mine?.review ?? null,
            reviewCount: counted?.reviewCount ?? 0,
        });
    })
    .post(
        '/:itemId/isbns',
        schemaValidator('param', ItemParamSchema),
        schemaValidator('json', OwnedIsbnSchema),
        async (c) => {
            const { id, itemId } = c.req.valid('param');
            const { isbn } = c.req.valid('json');
            const me = c.get('user').id;
            await requireMember(id, me);

            const found = await requireEntry(id, itemId);
            if (!(await addEdition(found.catalogItemId, isbn, me))) {
                throw new HTTPException(409, {
                    message: 'That ISBN is already on another book',
                });
            }
            await db()
                .insert(collectionItemIsbn)
                .values({ collectionItemId: itemId, isbn })
                .onConflictDoNothing();
            return c.body(null, 204);
        }
    )
    .delete(
        '/:itemId/isbns/:isbn',
        schemaValidator('param', EntryIsbnParamSchema),
        async (c) => {
            const { id, itemId, isbn } = c.req.valid('param');
            await requireMember(id, c.get('user').id);
            await requireEntry(id, itemId);

            const [removed] = await db()
                .delete(collectionItemIsbn)
                .where(
                    and(
                        eq(collectionItemIsbn.collectionItemId, itemId),
                        eq(collectionItemIsbn.isbn, isbn)
                    )
                )
                .returning({ isbn: collectionItemIsbn.isbn });
            if (!removed) {
                throw new HTTPException(404, { message: 'Edition not found' });
            }
            return c.body(null, 204);
        }
    )
    // Editions of the item that this entry doesn't own yet, to pick from.
    .get(
        '/:itemId/editions',
        schemaValidator('param', ItemParamSchema),
        schemaValidator('query', PageQuerySchema),
        async (c) => {
            const { id, itemId } = c.req.valid('param');
            await requireMember(id, c.get('user').id);
            const found = await requireEntry(id, itemId);

            const page = await paginate(c.req.valid('query'), (limit, offset) =>
                db()
                    .select({
                        isbn: catalogItemIsbn.isbn,
                        title: catalogItemIsbn.title,
                        coverUrl: catalogItemIsbn.coverUrl,
                        publisher: catalogItemIsbn.publisher,
                        language: catalogItemIsbn.language,
                        format: catalogItemIsbn.format,
                    })
                    .from(catalogItemIsbn)
                    .leftJoin(
                        collectionItemIsbn,
                        and(
                            eq(collectionItemIsbn.isbn, catalogItemIsbn.isbn),
                            eq(collectionItemIsbn.collectionItemId, itemId)
                        )
                    )
                    .where(
                        and(
                            eq(
                                catalogItemIsbn.catalogItemId,
                                found.catalogItemId
                            ),
                            eq(catalogItemIsbn.pending, false),
                            isNull(collectionItemIsbn.isbn)
                        )
                    )
                    .orderBy(
                        asc(catalogItemIsbn.createdAt),
                        asc(catalogItemIsbn.isbn)
                    )
                    .limit(limit)
                    .offset(offset)
            );
            return c.json(page);
        }
    )
    .get(
        '/:itemId/reviews',
        schemaValidator('param', ItemParamSchema),
        schemaValidator('query', PageQuerySchema),
        async (c) => {
            const { id, itemId } = c.req.valid('param');
            const me = c.get('user').id;
            await requireMember(id, me);
            const found = await requireEntry(id, itemId);

            const page = await paginate(c.req.valid('query'), (limit, offset) =>
                db()
                    .select({
                        ...userColumns,
                        rating: progress.rating,
                        review: progress.review,
                    })
                    .from(progress)
                    .innerJoin(user, eq(user.id, progress.userId))
                    .where(othersReviewed(found.catalogItemId, me))
                    .orderBy(desc(progress.updatedAt), asc(user.id))
                    .limit(limit)
                    .offset(offset)
            );
            return c.json(page);
        }
    )
    .delete(
        '/:itemId',
        schemaValidator('param', ItemParamSchema),
        async (c) => {
            const { id, itemId } = c.req.valid('param');
            await requireMember(id, c.get('user').id);

            const [removed] = await db()
                .delete(collectionItem)
                .where(
                    and(
                        eq(collectionItem.id, itemId),
                        eq(collectionItem.collectionId, id)
                    )
                )
                .returning({ id: collectionItem.id });
            if (!removed) {
                throw new HTTPException(404, { message: 'Item not found' });
            }
            return c.body(null, 204);
        }
    );

export default collectionItems;
