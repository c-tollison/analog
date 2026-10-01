import {
    and,
    asc,
    desc,
    eq,
    ilike,
    inArray,
    or,
    schema,
    sql,
} from '@analog/db';
import { PageQuerySchema } from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { itemDetails } from '../lib/books.js';
import { requireMember } from '../lib/collections.js';
import { userColumns } from '../lib/friends.js';
import { db } from '../lib/init.js';
import {
    othersReviewed,
    requireVisibleItem,
    visibleEditions,
} from '../lib/items.js';
import { paginate } from '../lib/pagination.js';
import { IdParamSchema } from '../lib/params.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { z } from 'zod';

// One catalog item's page, the same for everyone: its details, the person's
// own status and shelves, its editions and everyone's reviews.

const { catalogItemIsbn, progress, user } = schema;

const EditionsQuerySchema = PageQuerySchema.extend({
    // Marks the editions this shelf owns and lists them first.
    collectionId: z.uuid('Invalid id').optional(),
    q: z.string().trim().max(100).optional(),
});

// Matches an ISBN typed with or without dashes, or part of a publisher or
// edition title.
function editionsMatching(q: string) {
    const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');
    const digits = q.replace(/[\s-]/g, '');
    return or(
        digits
            ? ilike(catalogItemIsbn.isbn, `%${escapeLike(digits)}%`)
            : undefined,
        ilike(catalogItemIsbn.publisher, `%${escapeLike(q)}%`),
        ilike(catalogItemIsbn.title, `%${escapeLike(q)}%`)
    );
}

const items = new Hono<AppEnv>()
    .get('/:id', schemaValidator('param', IdParamSchema), async (c) => {
        const { id } = c.req.valid('param');
        const me = c.get('user').id;
        const { item, shelves } = await requireVisibleItem(id, me);
        const owned = shelves.flatMap((shelf) => shelf.isbns);

        const [main, [mine], [reviews], [editions]] = await Promise.all([
            db().query.catalogItemIsbn.findFirst({
                where: and(
                    eq(catalogItemIsbn.catalogItemId, id),
                    eq(catalogItemIsbn.main, true)
                ),
            }),
            db()
                .select({
                    status: progress.status,
                    rating: progress.rating,
                    review: progress.review,
                })
                .from(progress)
                .where(
                    and(eq(progress.userId, me), eq(progress.catalogItemId, id))
                ),
            db()
                .select({ count: sql<number>`count(*)::int` })
                .from(progress)
                .where(othersReviewed(id, me)),
            db()
                .select({ count: sql<number>`count(*)::int` })
                .from(catalogItemIsbn)
                .where(
                    and(
                        eq(catalogItemIsbn.catalogItemId, id),
                        visibleEditions(owned)
                    )
                ),
        ]);

        return c.json({
            id: item.id,
            format: item.format,
            kind: item.kind,
            title: item.title,
            coverUrl: main?.coverUrl ?? item.coverUrl,
            position: item.position,
            seriesId: item.series?.id ?? null,
            seriesTitle: item.series?.title ?? null,
            volumeCount: item.series?.volumeCount ?? null,
            ...itemDetails(item, main ?? null),
            saveCount: item.saveCount,
            ratingAverage: item.ratingAverage,
            ratingCount: item.ratingCount,
            status: mine?.status ?? null,
            rating: mine?.rating ?? null,
            review: mine?.review ?? null,
            reviewCount: reviews?.count ?? 0,
            editionCount: editions?.count ?? 0,
            shelves,
        });
    })
    .get(
        '/:id/editions',
        schemaValidator('param', IdParamSchema),
        schemaValidator('query', EditionsQuerySchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { collectionId, q, ...pageQuery } = c.req.valid('query');
            const me = c.get('user').id;
            const { shelves } = await requireVisibleItem(id, me);
            if (collectionId) {
                await requireMember(collectionId, me);
            }
            const ownedHere =
                shelves.find((shelf) => shelf.id === collectionId)?.isbns ?? [];
            const owned = sql<boolean>`${
                ownedHere.length
                    ? inArray(catalogItemIsbn.isbn, ownedHere)
                    : sql`false`
            }`;

            const page = await paginate(pageQuery, (limit, offset) =>
                db()
                    .select({
                        isbn: catalogItemIsbn.isbn,
                        title: catalogItemIsbn.title,
                        coverUrl: catalogItemIsbn.coverUrl,
                        publisher: catalogItemIsbn.publisher,
                        language: catalogItemIsbn.language,
                        format: catalogItemIsbn.format,
                        main: catalogItemIsbn.main,
                        pending: catalogItemIsbn.pending,
                        owned,
                    })
                    .from(catalogItemIsbn)
                    .where(
                        and(
                            eq(catalogItemIsbn.catalogItemId, id),
                            visibleEditions(
                                shelves.flatMap((shelf) => shelf.isbns)
                            ),
                            q ? editionsMatching(q) : undefined
                        )
                    )
                    .orderBy(
                        ...(ownedHere.length ? [desc(owned)] : []),
                        desc(catalogItemIsbn.main),
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
        '/:id/reviews',
        schemaValidator('param', IdParamSchema),
        schemaValidator('query', PageQuerySchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const me = c.get('user').id;
            await requireVisibleItem(id, me);

            const page = await paginate(c.req.valid('query'), (limit, offset) =>
                db()
                    .select({
                        ...userColumns,
                        rating: progress.rating,
                        review: progress.review,
                    })
                    .from(progress)
                    .innerJoin(user, eq(user.id, progress.userId))
                    .where(othersReviewed(id, me))
                    .orderBy(desc(progress.updatedAt), asc(user.id))
                    .limit(limit)
                    .offset(offset)
            );
            return c.json(page);
        }
    );

export default items;
