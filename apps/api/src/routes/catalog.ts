import { and, eq, schema, sql } from '@analog/db';
import {
    AddBookSchema,
    CheckTrigger,
    IsbnSchema,
    ProgressStatus,
    ReviewSchema,
    SetProgressStatusSchema,
    UserRole,
} from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import {
    findOrCreateBook,
    findSimilarSeries,
    refreshBook,
    suggestSeries,
    toBookLookup,
} from '../lib/books.js';
import { checkInBackground } from '../lib/check-runs.js';
import { upsertBook } from '../lib/editions.js';
import { db } from '../lib/init.js';
import { IdParamSchema } from '../lib/params.js';
import { isCompleted, refreshItemStats } from '../lib/progress.js';
import { schemaValidator } from '../lib/validator.js';
import { requireRole } from '../middleware/require-role.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const IsbnParamSchema = z.object({ isbn: IsbnSchema });

const {
    catalogItem,
    catalogItemIsbnCover,
    collectionItem,
    collectionItemIsbn,
    collectionMember,
    progress,
} = schema;

async function requireCatalogItem(id: string): Promise<void> {
    const found = await db().query.catalogItem.findFirst({
        columns: { id: true },
        where: eq(catalogItem.id, id),
    });
    if (!found) {
        throw new HTTPException(404, { message: 'Item not found' });
    }
}

// The user's collections that own this edition. One that only has another
// edition of the book can still add this one.
async function collectionsOwning(
    isbn: string,
    userId: string
): Promise<string[]> {
    const rows = await db()
        .select({ id: collectionItem.collectionId })
        .from(collectionItemIsbn)
        .innerJoin(
            collectionItem,
            eq(collectionItem.id, collectionItemIsbn.collectionItemId)
        )
        .innerJoin(
            collectionMember,
            eq(collectionMember.collectionId, collectionItem.collectionId)
        )
        .where(
            and(
                eq(collectionItemIsbn.isbn, isbn),
                eq(collectionMember.userId, userId)
            )
        );
    return rows.map((row) => row.id);
}

const catalog = new Hono<AppEnv>()
    .put(
        '/items/:id/status',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', SetProgressStatusSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { status } = c.req.valid('json');
            const user = c.get('user');
            await requireCatalogItem(id);

            const completed = status === ProgressStatus.Completed;
            const [saved] = await db()
                .insert(progress)
                .values({
                    userId: user.id,
                    catalogItemId: id,
                    status,
                    completedAt: completed ? new Date() : null,
                })
                .onConflictDoUpdate({
                    target: [progress.userId, progress.catalogItemId],
                    set: {
                        status,
                        completedAt: completed
                            ? sql`coalesce(${progress.completedAt}, now())`
                            : null,
                        updatedAt: new Date(),
                    },
                })
                // The stored rating and review, so the app can ask for one
                // when there's none yet.
                .returning({
                    status: progress.status,
                    rating: progress.rating,
                    review: progress.review,
                    completedAt: progress.completedAt,
                });
            await refreshItemStats(id);
            return c.json(saved);
        }
    )
    .put(
        '/items/:id/review',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', ReviewSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { rating, review, completedAt } = c.req.valid('json');
            const user = c.get('user');

            const [saved] = await db()
                .update(progress)
                .set({
                    rating,
                    review,
                    completedAt: completedAt ? new Date(completedAt) : null,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(progress.userId, user.id),
                        eq(progress.catalogItemId, id),
                        isCompleted
                    )
                )
                .returning({
                    rating: progress.rating,
                    review: progress.review,
                    completedAt: progress.completedAt,
                });
            if (!saved) {
                throw new HTTPException(400, {
                    message: 'Mark it finished before reviewing it',
                });
            }
            await refreshItemStats(id);
            return c.json(saved);
        }
    )
    .post(
        '/items/:id/refresh',
        requireRole(UserRole.Admin),
        schemaValidator('param', IdParamSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const refreshed = await refreshBook(id);
            checkInBackground(id, CheckTrigger.Refresh);
            return c.json(refreshed);
        }
    )
    .get(
        '/isbn/:isbn',
        schemaValidator('param', IsbnParamSchema),
        async (c) => {
            const { isbn } = c.req.valid('param');
            const user = c.get('user');

            const { item, fetched } = await findOrCreateBook(isbn, user.id);
            const book =
                fetched ?? toBookLookup(item, item.series, isbn, item.edition);

            const [suggested, inCollectionIds] = await Promise.all([
                suggestSeries(item, book, user.id),
                collectionsOwning(isbn, user.id),
            ]);
            const similarSeries = suggested
                ? []
                : await findSimilarSeries(book.title, user.id);
            return c.json({
                book,
                itemId: item.id,
                // A checked book, or one already in a series, has nothing
                // left to pick.
                isPlaced: !!item.verifiedAt || !!item.seriesId,
                suggestedSeries: suggested
                    ? { id: suggested.id, title: suggested.title }
                    : null,
                similarSeries,
                inCollectionIds,
                // Set by an earlier scan, so this one can't change them.
                savedSeriesTitle: item.series?.title ?? null,
                savedVolume: item.series ? item.position : null,
            });
        }
    )
    // Saves a looked-up book with the series and volume picked, without
    // putting it on a shelf.
    .post('/books', schemaValidator('json', AddBookSchema), async (c) => {
        const { isbn, series, volume } = c.req.valid('json');
        const item = await upsertBook(isbn, series, volume, {
            userId: c.get('user').id,
            admin: false,
        });
        return c.json({ id: item.id, seriesId: item.seriesId }, 201);
    })
    // A cover an admin uploaded. Its URL changes with each upload.
    .get(
        '/covers/:isbn',
        schemaValidator('param', IsbnParamSchema),
        async (c) => {
            const { isbn } = c.req.valid('param');
            const [found] = await db()
                .select({ data: catalogItemIsbnCover.data })
                .from(catalogItemIsbnCover)
                .where(eq(catalogItemIsbnCover.isbn, isbn));
            if (!found) {
                throw new HTTPException(404, { message: 'Cover not found' });
            }
            return c.body(new Uint8Array(found.data), 200, {
                'Content-Type': 'image/webp',
                'Cache-Control': 'private, max-age=31536000, immutable',
            });
        }
    );

export default catalog;
