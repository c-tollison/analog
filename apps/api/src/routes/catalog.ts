import { and, eq, schema } from '@analog/db';
import { IsbnSchema } from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import {
    findOrCreateBook,
    findSimilarSeries,
    suggestSeries,
    toBookLookup,
} from '../lib/books.js';
import { db } from '../lib/init.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { z } from 'zod';

const IsbnParamSchema = z.object({ isbn: IsbnSchema });

const { collectionItem, collectionMember } = schema;

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

const catalog = new Hono<AppEnv>().get(
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
