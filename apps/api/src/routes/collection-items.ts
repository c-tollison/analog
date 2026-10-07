import { and, eq, notExists, schema } from '@analog/db';
import { IsbnSchema, OwnEditionSchema } from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { ownEdition, requireMember } from '../lib/collections.js';
import { addEdition } from '../lib/editions.js';
import { db } from '../lib/init.js';
import { requireItem } from '../lib/items.js';
import { IdParamSchema } from '../lib/params.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

// What a collection owns: whole entries, mounted at /collections/:id/items,
// and single editions, mounted at /collections/:id/editions. They're in their
// own routers so the collections router's type doesn't get too deep for
// TypeScript.

const { collectionItem, collectionItemIsbn } = schema;

const ItemParamSchema = IdParamSchema.extend({
    itemId: z.uuid('Invalid id'),
});
const EditionParamSchema = IdParamSchema.extend({ isbn: IsbnSchema });

const collectionItems = new Hono<AppEnv>().delete(
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
            throw new HTTPException(404, { message: 'Book not found' });
        }
        return c.body(null, 204);
    }
);

export const collectionEditions = new Hono<AppEnv>()
    // Owns an edition of an item, adding the item to the collection if it
    // isn't there yet. A new ISBN joins the item and waits on an admin.
    .put(
        '/:isbn',
        schemaValidator('param', EditionParamSchema),
        schemaValidator('json', OwnEditionSchema),
        async (c) => {
            const { id, isbn } = c.req.valid('param');
            const { catalogItemId } = c.req.valid('json');
            const me = c.get('user').id;
            await requireMember(id, me);
            await requireItem(catalogItemId, me);

            if (!(await addEdition(catalogItemId, isbn, me))) {
                throw new HTTPException(409, {
                    message: 'That ISBN is already on another book',
                });
            }
            await ownEdition(id, catalogItemId, isbn, me);
            return c.body(null, 204);
        }
    )
    // An entry needs an edition, so removing the last one removes the entry
    // too.
    .delete(
        '/:isbn',
        schemaValidator('param', EditionParamSchema),
        async (c) => {
            const { id, isbn } = c.req.valid('param');
            await requireMember(id, c.get('user').id);

            const removedEntry = await db().transaction(async (tx) => {
                const [owned] = await tx
                    .select({ entryId: collectionItem.id })
                    .from(collectionItemIsbn)
                    .innerJoin(
                        collectionItem,
                        eq(
                            collectionItem.id,
                            collectionItemIsbn.collectionItemId
                        )
                    )
                    .where(
                        and(
                            eq(collectionItem.collectionId, id),
                            eq(collectionItemIsbn.isbn, isbn)
                        )
                    );
                if (!owned) {
                    throw new HTTPException(404, {
                        message: 'Edition not found',
                    });
                }
                await tx
                    .delete(collectionItemIsbn)
                    .where(
                        and(
                            eq(
                                collectionItemIsbn.collectionItemId,
                                owned.entryId
                            ),
                            eq(collectionItemIsbn.isbn, isbn)
                        )
                    );
                const [emptied] = await tx
                    .delete(collectionItem)
                    .where(
                        and(
                            eq(collectionItem.id, owned.entryId),
                            notExists(
                                tx
                                    .select({ isbn: collectionItemIsbn.isbn })
                                    .from(collectionItemIsbn)
                                    .where(
                                        eq(
                                            collectionItemIsbn.collectionItemId,
                                            owned.entryId
                                        )
                                    )
                            )
                        )
                    )
                    .returning({ id: collectionItem.id });
                return !!emptied;
            });
            return c.json({ removedEntry });
        }
    );

export default collectionItems;
