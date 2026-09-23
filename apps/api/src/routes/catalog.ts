import { and, eq, schema, sql } from '@analog/db';
import {
    IsbnSchema,
    ProgressStatus,
    ReviewSchema,
    SetProgressStatusSchema,
} from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import {
    findOrCreateBook,
    findSimilarSeries,
    suggestSeries,
    toBookLookup,
} from '../lib/books.js';
import { db } from '../lib/init.js';
import { IdParamSchema } from '../lib/params.js';
import { isCompleted } from '../lib/progress.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const IsbnParamSchema = z.object({ isbn: IsbnSchema });

const { catalogItem, collectionItem, collectionMember, progress } = schema;

async function requireCatalogItem(id: string): Promise<void> {
    const found = await db().query.catalogItem.findFirst({
        columns: { id: true },
        where: eq(catalogItem.id, id),
    });
    if (!found) {
        throw new HTTPException(404, { message: 'Item not found' });
    }
}

async function collectionsContaining(
    catalogItemId: string | undefined,
    userId: string
): Promise<string[]> {
    if (!catalogItemId) return [];
    const rows = await db()
        .select({ id: collectionItem.collectionId })
        .from(collectionItem)
        .innerJoin(
            collectionMember,
            eq(collectionMember.collectionId, collectionItem.collectionId)
        )
        .where(
            and(
                eq(collectionItem.catalogItemId, catalogItemId),
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
                .returning({ status: progress.status });
            return c.json(saved);
        }
    )
    .put(
        '/items/:id/review',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', ReviewSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { rating, review } = c.req.valid('json');
            const user = c.get('user');

            const [saved] = await db()
                .update(progress)
                .set({ rating, review, updatedAt: new Date() })
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
                });
            if (!saved) {
                throw new HTTPException(400, {
                    message: 'Mark it finished before reviewing it',
                });
            }
            return c.json(saved);
        }
    )
    .get(
        '/isbn/:isbn',
        schemaValidator('param', IsbnParamSchema),
        async (c) => {
            const { isbn } = c.req.valid('param');
            const user = c.get('user');

            const { item, fetched } = await findOrCreateBook(isbn, user.id);
            const book = fetched ?? toBookLookup(item, item.series);

            const [suggested, inCollectionIds] = await Promise.all([
                suggestSeries(item, book),
                collectionsContaining(item.id, user.id),
            ]);
            const similarSeries = suggested
                ? []
                : await findSimilarSeries(book.title);
            return c.json({
                book,
                suggestedSeries: suggested
                    ? { id: suggested.id, title: suggested.title }
                    : null,
                similarSeries,
                inCollectionIds,
            });
        }
    );

export default catalog;
