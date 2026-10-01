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
import { normalizeIsbn, PageQuerySchema } from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { itemDetails } from '../lib/books.js';
import { requireMember } from '../lib/collections.js';
import { visibleToVisitors } from '../lib/discovery.js';
import { userColumns } from '../lib/friends.js';
import { db } from '../lib/init.js';
import { othersReviewed, requireItem, visibleEditions } from '../lib/items.js';
import { paginate } from '../lib/pagination.js';
import { IdParamSchema } from '../lib/params.js';
import { catalogItemsMatching, relevance, searchTerms } from '../lib/search.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { z } from 'zod';

// One catalog item's page, the same for everyone: its details, the person's
// own status and shelves, its editions and everyone's reviews.

const { catalogItem, catalogItemIsbn, progress, series, user } = schema;

const EditionsQuerySchema = PageQuerySchema.extend({
    // Marks the editions this shelf owns and lists them first.
    collectionId: z.uuid('Invalid id').optional(),
    q: z.string().trim().max(100).optional(),
});

// Matches an ISBN typed with or without dashes, or part of a publisher or
// edition title. A full ISBN-10 matches its stored ISBN-13.
function editionsMatching(q: string) {
    const isbn = normalizeIsbn(q);
    if (isbn) {
        return eq(catalogItemIsbn.isbn, isbn);
    }
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

const SearchQuerySchema = PageQuerySchema.extend({
    q: z.string().trim().min(1).max(200),
});

const items = new Hono<AppEnv>()
    // Books anyone can find, plus the person's own unchecked ones. Closest
    // matches first, then the most saved.
    .get('/search', schemaValidator('query', SearchQuerySchema), async (c) => {
        const { q, ...pageQuery } = c.req.valid('query');
        const me = c.get('user').id;
        const terms = searchTerms(q);
        const titles = [catalogItem.title, series.title];

        const page = await paginate(pageQuery, (limit, offset) =>
            db()
                .select({
                    id: catalogItem.id,
                    format: catalogItem.format,
                    title: catalogItem.title,
                    coverUrl: catalogItem.coverUrl,
                    position: catalogItem.position,
                    releaseDate: catalogItem.releaseDate,
                    seriesId: series.id,
                    seriesTitle: series.title,
                    volumeCount: series.volumeCount,
                    author: sql<
                        string | null
                    >`${catalogItem.metadata}->'authors'->>0`,
                    saveCount: catalogItem.saveCount,
                    ratingAverage: catalogItem.ratingAverage,
                    ratingCount: catalogItem.ratingCount,
                    isUnreviewed: sql<boolean>`not coalesce(${visibleToVisitors()}, false)`,
                    status: progress.status,
                })
                .from(catalogItem)
                .leftJoin(series, eq(series.id, catalogItem.seriesId))
                .leftJoin(
                    progress,
                    and(
                        eq(progress.catalogItemId, catalogItem.id),
                        eq(progress.userId, me)
                    )
                )
                .where(
                    and(
                        catalogItemsMatching(terms),
                        or(
                            visibleToVisitors(),
                            eq(catalogItem.createdByUserId, me)
                        )
                    )
                )
                .orderBy(
                    desc(relevance(terms.join(' '), titles)),
                    desc(catalogItem.saveCount),
                    sql`${catalogItem.position} asc nulls last`,
                    asc(catalogItem.title),
                    asc(catalogItem.id)
                )
                .limit(limit)
                .offset(offset)
        );
        return c.json(page);
    })
    .get('/:id', schemaValidator('param', IdParamSchema), async (c) => {
        const { id } = c.req.valid('param');
        const me = c.get('user').id;
        const { item, shelves } = await requireItem(id, me);
        const owned = shelves.map((shelf) => shelf.isbn);

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
                    completedAt: progress.completedAt,
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
            completedAt: mine?.completedAt ?? null,
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
            const { shelves } = await requireItem(id, me);
            if (collectionId) {
                await requireMember(collectionId, me);
            }
            const ownedHere = shelves
                .filter((shelf) => shelf.id === collectionId)
                .map((shelf) => shelf.isbn);
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
                            visibleEditions(shelves.map((shelf) => shelf.isbn)),
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
            await requireItem(id, me);

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
