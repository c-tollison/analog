import { and, eq, schema } from '@analog/db';
import { IsbnSchema } from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { findBookByIsbn, suggestSeries, toBookLookup } from '../lib/books.js';
import { db } from '../lib/init.js';
import { lookupIsbn } from '../lib/open-library.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const IsbnParamSchema = z.object({ isbn: IsbnSchema });

const { collectionItem, collectionMember } = schema;

async function collectionsContaining(catalogItemId: string, userId: string) {
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

        const existing = await findBookByIsbn(isbn);
        const book = existing
            ? toBookLookup(existing, existing.series)
            : await lookupIsbn(isbn);
        if (!book) {
            throw new HTTPException(404, {
                message: `No book found for ISBN ${isbn}`,
            });
        }

        const [suggested, inCollectionIds] = await Promise.all([
            suggestSeries(existing, book),
            existing ? collectionsContaining(existing.id, user.id) : [],
        ]);
        return c.json({
            book,
            suggestedSeries: suggested
                ? { id: suggested.id, title: suggested.title }
                : null,
            inCollectionIds,
        });
    }
);

export default catalog;
