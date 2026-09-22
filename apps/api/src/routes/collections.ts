import { and, asc, desc, eq, inArray, schema, sql } from '@analog/db';
import {
    AddBookSchema,
    AddCatalogItemsSchema,
    CollectionRole,
    CreateCollectionSchema,
    type MediaFormat,
    PageQuerySchema,
    type SeriesKind,
} from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { seriesColumns, upsertBook } from '../lib/books.js';
import { requireMember } from '../lib/collections.js';
import { db } from '../lib/init.js';
import { paginate } from '../lib/pagination.js';
import { matchesAllTerms, relevance, searchTerms } from '../lib/search.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const { collection, collectionMember, collectionItem, catalogItem, series } =
    schema;

const CollectionParamSchema = z.object({ id: z.uuid('Invalid id') });
const ItemParamSchema = CollectionParamSchema.extend({
    itemId: z.uuid('Invalid id'),
});
const SeriesParamSchema = CollectionParamSchema.extend({
    seriesId: z.uuid('Invalid id'),
});
const EntriesQuerySchema = PageQuerySchema.extend({
    q: z.string().trim().max(200).optional(),
});
const SearchQuerySchema = PageQuerySchema.extend({
    q: z.string().trim().min(1).max(200),
});

const itemColumns = {
    id: collectionItem.id,
    format: catalogItem.format,
    kind: catalogItem.kind,
    title: catalogItem.title,
    coverUrl: catalogItem.coverUrl,
    position: catalogItem.position,
};

function collectionSummaries(userId: string, collectionId?: string) {
    return db()
        .select({
            id: collection.id,
            name: collection.name,
            role: collectionMember.role,
            itemCount: sql<number>`(
                select count(*)::int from ${collectionItem}
                where ${collectionItem.collectionId} = ${collection.id}
            )`,
            memberCount: sql<number>`(
                select count(*)::int from ${collectionMember} m
                where m.collection_id = ${collection.id}
            )`,
        })
        .from(collectionMember)
        .innerJoin(collection, eq(collectionMember.collectionId, collection.id))
        .where(
            and(
                eq(collectionMember.userId, userId),
                collectionId ? eq(collection.id, collectionId) : undefined
            )
        )
        .orderBy(sql`lower(${collection.name})`, asc(collection.id))
        .$dynamic();
}

const collections = new Hono<AppEnv>()
    .get('/', schemaValidator('query', PageQuerySchema), async (c) => {
        const user = c.get('user');
        const page = await paginate(c.req.valid('query'), (limit, offset) =>
            collectionSummaries(user.id).limit(limit).offset(offset)
        );
        return c.json(page);
    })
    .get('/search', schemaValidator('query', SearchQuerySchema), async (c) => {
        const { q, ...pageQuery } = c.req.valid('query');
        const user = c.get('user');
        const terms = searchTerms(q);
        const titles = [catalogItem.title, series.title];
        const page = await paginate(pageQuery, (limit, offset) =>
            db()
                .select({
                    ...itemColumns,
                    seriesId: catalogItem.seriesId,
                    collectionId: collection.id,
                    collectionName: collection.name,
                })
                .from(collectionItem)
                .innerJoin(
                    collectionMember,
                    and(
                        eq(
                            collectionMember.collectionId,
                            collectionItem.collectionId
                        ),
                        eq(collectionMember.userId, user.id)
                    )
                )
                .innerJoin(
                    collection,
                    eq(collection.id, collectionItem.collectionId)
                )
                .innerJoin(
                    catalogItem,
                    eq(collectionItem.catalogItemId, catalogItem.id)
                )
                .leftJoin(series, eq(catalogItem.seriesId, series.id))
                .where(
                    matchesAllTerms(terms, {
                        columns: titles,
                        position: catalogItem.position,
                    })
                )
                .orderBy(
                    desc(relevance(terms.join(' '), titles)),
                    sql`lower(${collection.name})`,
                    sql`${catalogItem.position} asc nulls last`,
                    asc(collectionItem.id)
                )
                .limit(limit)
                .offset(offset)
        );

        return c.json(page);
    })
    .post('/', schemaValidator('json', CreateCollectionSchema), async (c) => {
        const { name } = c.req.valid('json');
        const user = c.get('user');

        const created = await db().transaction(async (tx) => {
            const [row] = await tx
                .insert(collection)
                .values({ name })
                .returning({ id: collection.id });
            if (!row) {
                throw new Error('Failed to create collection');
            }
            await tx.insert(collectionMember).values({
                collectionId: row.id,
                userId: user.id,
                role: CollectionRole.Owner,
            });
            return row;
        });

        return c.json(created, 201);
    })
    .get('/:id', schemaValidator('param', CollectionParamSchema), async (c) => {
        const { id } = c.req.valid('param');
        const [found] = await collectionSummaries(c.get('user').id, id);
        if (!found) {
            throw new HTTPException(404, { message: 'Collection not found' });
        }
        return c.json(found);
    })
    .delete(
        '/:id',
        schemaValidator('param', CollectionParamSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            await requireMember(id, c.get('user').id, CollectionRole.Owner);
            await db().delete(collection).where(eq(collection.id, id));
            return c.body(null, 204);
        }
    )
    .get(
        '/:id/entries',
        schemaValidator('param', CollectionParamSchema),
        schemaValidator('query', EntriesQuerySchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { q, ...pageQuery } = c.req.valid('query');
            await requireMember(id, c.get('user').id);

            const terms = searchTerms(q ?? '');
            if (terms.length) {
                const titles = [catalogItem.title, series.title];
                const page = await paginate(pageQuery, (limit, offset) =>
                    db()
                        .select({ ...itemColumns, series: sql<null>`null` })
                        .from(collectionItem)
                        .innerJoin(
                            catalogItem,
                            eq(collectionItem.catalogItemId, catalogItem.id)
                        )
                        .leftJoin(series, eq(catalogItem.seriesId, series.id))
                        .where(
                            and(
                                eq(collectionItem.collectionId, id),
                                matchesAllTerms(terms, {
                                    columns: titles,
                                    position: catalogItem.position,
                                })
                            )
                        )
                        .orderBy(
                            desc(relevance(terms.join(' '), titles)),
                            sql`${catalogItem.position} asc nulls last`,
                            asc(catalogItem.title),
                            asc(collectionItem.id)
                        )
                        .limit(limit)
                        .offset(offset)
                );
                return c.json(page);
            }

            const groupKey = sql<string>`coalesce(${catalogItem.seriesId}, ${catalogItem.id})`;
            const itemTitle = sql<string>`min(${catalogItem.title})`;

            const page = await paginate(pageQuery, (limit, offset) =>
                db()
                    .select({
                        series: seriesColumns,
                        ownedCount: sql<number>`count(*)::int`,
                        id: sql<string>`min(${collectionItem.id}::text)`,
                        format: sql<MediaFormat>`min(${catalogItem.format}::text)`,
                        kind: sql<SeriesKind | null>`min(${catalogItem.kind}::text)`,
                        title: itemTitle,
                        coverUrl: sql<
                            string | null
                        >`min(${catalogItem.coverUrl})`,
                        position: sql<
                            number | null
                        >`min(${catalogItem.position})::float`,
                    })
                    .from(collectionItem)
                    .innerJoin(
                        catalogItem,
                        eq(collectionItem.catalogItemId, catalogItem.id)
                    )
                    .leftJoin(series, eq(catalogItem.seriesId, series.id))
                    .where(eq(collectionItem.collectionId, id))
                    .groupBy(groupKey, series.id)
                    .orderBy(
                        sql`lower(coalesce(${series.title}, ${itemTitle}))`,
                        groupKey
                    )
                    .limit(limit)
                    .offset(offset)
            );

            return c.json(page);
        }
    )
    .get(
        '/:id/series/:seriesId',
        schemaValidator('param', SeriesParamSchema),
        async (c) => {
            const { id, seriesId } = c.req.valid('param');
            await requireMember(id, c.get('user').id);

            const [[found], [counted]] = await Promise.all([
                db()
                    .select(seriesColumns)
                    .from(series)
                    .where(eq(series.id, seriesId)),
                db()
                    .select({ ownedCount: sql<number>`count(*)::int` })
                    .from(collectionItem)
                    .innerJoin(
                        catalogItem,
                        eq(collectionItem.catalogItemId, catalogItem.id)
                    )
                    .where(
                        and(
                            eq(collectionItem.collectionId, id),
                            eq(catalogItem.seriesId, seriesId)
                        )
                    ),
            ]);
            if (!found) {
                throw new HTTPException(404, { message: 'Series not found' });
            }

            return c.json({
                series: found,
                ownedCount: counted?.ownedCount ?? 0,
            });
        }
    )
    .get(
        '/:id/series/:seriesId/items',
        schemaValidator('param', SeriesParamSchema),
        schemaValidator('query', PageQuerySchema),
        async (c) => {
            const { id, seriesId } = c.req.valid('param');
            await requireMember(id, c.get('user').id);

            const page = await paginate(c.req.valid('query'), (limit, offset) =>
                db()
                    .select(itemColumns)
                    .from(collectionItem)
                    .innerJoin(
                        catalogItem,
                        eq(collectionItem.catalogItemId, catalogItem.id)
                    )
                    .where(
                        and(
                            eq(collectionItem.collectionId, id),
                            eq(catalogItem.seriesId, seriesId)
                        )
                    )
                    .orderBy(
                        sql`${catalogItem.position} asc nulls last`,
                        asc(catalogItem.title),
                        asc(collectionItem.id)
                    )
                    .limit(limit)
                    .offset(offset)
            );

            return c.json(page);
        }
    )
    .get(
        '/:id/catalog/series/:seriesId',
        schemaValidator('param', SeriesParamSchema),
        schemaValidator('query', PageQuerySchema),
        async (c) => {
            const { id, seriesId } = c.req.valid('param');
            await requireMember(id, c.get('user').id);

            const page = await paginate(c.req.valid('query'), (limit, offset) =>
                db()
                    .select({
                        id: catalogItem.id,
                        format: catalogItem.format,
                        title: catalogItem.title,
                        coverUrl: catalogItem.coverUrl,
                        position: catalogItem.position,
                        inCollection: sql<boolean>`${collectionItem.id} is not null`,
                    })
                    .from(catalogItem)
                    .leftJoin(
                        collectionItem,
                        and(
                            eq(collectionItem.catalogItemId, catalogItem.id),
                            eq(collectionItem.collectionId, id)
                        )
                    )
                    .where(eq(catalogItem.seriesId, seriesId))
                    .orderBy(
                        sql`${catalogItem.position} asc nulls last`,
                        asc(catalogItem.title),
                        asc(catalogItem.id)
                    )
                    .limit(limit)
                    .offset(offset)
            );
            return c.json(page);
        }
    )
    .post(
        '/:id/items',
        schemaValidator('param', CollectionParamSchema),
        schemaValidator('json', AddCatalogItemsSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { catalogItemIds } = c.req.valid('json');
            const user = c.get('user');
            await requireMember(id, user.id);

            const uniqueIds = [...new Set(catalogItemIds)];
            const found = await db()
                .select({ id: catalogItem.id })
                .from(catalogItem)
                .where(inArray(catalogItem.id, uniqueIds));
            if (found.length !== uniqueIds.length) {
                throw new HTTPException(404, {
                    message: 'Some items no longer exist in the catalog',
                });
            }

            const added = await db()
                .insert(collectionItem)
                .values(
                    uniqueIds.map((catalogItemId) => ({
                        collectionId: id,
                        catalogItemId,
                        addedByUserId: user.id,
                    }))
                )
                .onConflictDoNothing()
                .returning({ id: collectionItem.id });

            return c.json({ added: added.length }, 201);
        }
    )
    .post(
        '/:id/books',
        schemaValidator('param', CollectionParamSchema),
        schemaValidator('json', AddBookSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { isbn, series: seriesChoice, volume } = c.req.valid('json');
            const user = c.get('user');
            await requireMember(id, user.id);

            const item = await upsertBook(isbn, seriesChoice, volume, user.id);

            const [added] = await db()
                .insert(collectionItem)
                .values({
                    collectionId: id,
                    catalogItemId: item.id,
                    addedByUserId: user.id,
                })
                .onConflictDoNothing()
                .returning({ id: collectionItem.id });
            if (!added) {
                throw new HTTPException(409, {
                    message: 'Already in this collection',
                });
            }

            return c.json({ id: added.id }, 201);
        }
    )
    .delete(
        '/:id/items/:itemId',
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

export default collections;
