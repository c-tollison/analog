import {
    and,
    asc,
    desc,
    eq,
    ilike,
    inArray,
    isNotNull,
    ne,
    notExists,
    or,
    schema,
    sql,
} from '@analog/db';
import {
    AddBookSchema,
    AddCatalogItemsSchema,
    CollectionRole,
    CreateCollectionSchema,
    type MediaFormat,
    PageQuerySchema,
    ProgressStatus,
    type SeriesKind,
    UserIdSchema,
} from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { itemDetails, seriesColumns, upsertBook } from '../lib/books.js';
import { requireMember } from '../lib/collections.js';
import { areFriends, friendshipWith, userColumns } from '../lib/friends.js';
import { db } from '../lib/init.js';
import { likePattern, paginate } from '../lib/pagination.js';
import { IdParamSchema } from '../lib/params.js';
import { isCompleted, whenCompleted } from '../lib/progress.js';
import { matchesAllTerms, relevance, searchTerms } from '../lib/search.js';
import { seriesDetails } from '../lib/series-details.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const {
    collection,
    collectionMember,
    collectionItem,
    collectionInvite,
    catalogItem,
    friendship,
    progress,
    series,
    user,
} = schema;

/** Join condition: `progress` is this user's row for the catalog item. */
function myProgress(userId: string) {
    return and(
        eq(progress.catalogItemId, catalogItem.id),
        eq(progress.userId, userId)
    );
}

const myRating = whenCompleted<number>(progress.rating);

const completedCount = sql<number>`(
    count(*) filter (where ${isCompleted})
)::int`;

const CollectionParamSchema = IdParamSchema;
const ItemParamSchema = CollectionParamSchema.extend({
    itemId: z.uuid('Invalid id'),
});
const MemberParamSchema = CollectionParamSchema.extend({
    userId: z.uuid('Invalid id'),
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
const FriendsQuerySchema = PageQuerySchema.extend({
    q: z.string().trim().max(100).optional(),
});
const CatalogQuerySchema = EntriesQuerySchema.extend({
    seriesId: z.uuid('Invalid id').optional(),
});

const itemColumns = {
    id: collectionItem.id,
    format: catalogItem.format,
    kind: catalogItem.kind,
    title: catalogItem.title,
    coverUrl: catalogItem.coverUrl,
    position: catalogItem.position,
};

const MEMBER_PREVIEW_COUNT = 3;

type MemberPreview = Pick<typeof user.$inferSelect, 'id' | 'name' | 'image'>;

const ownerFirst = [
    sql`${collectionMember.role} = ${CollectionRole.Owner} desc`,
    asc(collectionMember.createdAt),
];

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
            // How much of the collection this user has finished.
            completedCount: sql<number>`(
                select count(*)::int from ${collectionItem} ci
                join ${progress} p on p.catalog_item_id = ci.catalog_item_id
                    and p.user_id = ${userId}
                where ci.collection_id = ${collection.id}
                    and p.status = ${ProgressStatus.Completed}
            )`,
            formats: sql<MediaFormat[]>`(
                select coalesce(json_agg(distinct c.format), '[]'::json)
                from ${collectionItem} ci
                join ${catalogItem} c on c.id = ci.catalog_item_id
                where ci.collection_id = ${collection.id}
            )`,
            memberCount: sql<number>`(
                select count(*)::int from ${collectionMember} m
                where m.collection_id = ${collection.id}
            )`,
            // The first few members for avatars, owner first.
            members: sql<MemberPreview[]>`(
                select coalesce(json_agg(p), '[]'::json) from (
                    select u.id, u.name, u.image
                    from ${collectionMember} m
                    join ${user} u on u.id = m.user_id
                    where m.collection_id = ${collection.id}
                    order by m.role = ${CollectionRole.Owner} desc,
                        m.created_at, u.id
                    limit ${MEMBER_PREVIEW_COUNT}
                ) p
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
            const me = c.get('user').id;
            await requireMember(id, me);

            const terms = searchTerms(q ?? '');
            if (terms.length) {
                const titles = [catalogItem.title, series.title];
                const page = await paginate(pageQuery, (limit, offset) =>
                    db()
                        .select({
                            ...itemColumns,
                            series: sql<null>`null`,
                            completedCount: sql<number>`0`,
                            status: progress.status,
                            rating: myRating,
                        })
                        .from(collectionItem)
                        .innerJoin(
                            catalogItem,
                            eq(collectionItem.catalogItemId, catalogItem.id)
                        )
                        .leftJoin(series, eq(catalogItem.seriesId, series.id))
                        .leftJoin(progress, myProgress(me))
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
                        completedCount,
                        // Only meaningful for items not in a series.
                        status: sql<ProgressStatus | null>`min(${progress.status}::text)`,
                        rating: sql<number | null>`min(${myRating})`,
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
                    .leftJoin(progress, myProgress(me))
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
            const me = c.get('user').id;
            await requireMember(id, me);

            const [found, [counted]] = await Promise.all([
                db().query.series.findFirst({
                    where: eq(series.id, seriesId),
                }),
                db()
                    .select({
                        ownedCount: sql<number>`count(*)::int`,
                        completedCount,
                        ownedPositions: sql<number[]>`coalesce(
                            array_agg(distinct ${catalogItem.position}::float)
                                filter (where ${catalogItem.position} is not null),
                            '{}'
                        )`,
                    })
                    .from(collectionItem)
                    .innerJoin(
                        catalogItem,
                        eq(collectionItem.catalogItemId, catalogItem.id)
                    )
                    .leftJoin(progress, myProgress(me))
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
                series: {
                    id: found.id,
                    title: found.title,
                    kind: found.kind,
                    coverUrl: found.coverUrl,
                },
                ownedCount: counted?.ownedCount ?? 0,
                completedCount: counted?.completedCount ?? 0,
                ownedPositions: counted?.ownedPositions ?? [],
                ...seriesDetails(found),
            });
        }
    )
    .get(
        '/:id/series/:seriesId/items',
        schemaValidator('param', SeriesParamSchema),
        schemaValidator('query', PageQuerySchema),
        async (c) => {
            const { id, seriesId } = c.req.valid('param');
            const me = c.get('user').id;
            await requireMember(id, me);

            const page = await paginate(c.req.valid('query'), (limit, offset) =>
                db()
                    .select({
                        ...itemColumns,
                        status: progress.status,
                        rating: myRating,
                    })
                    .from(collectionItem)
                    .innerJoin(
                        catalogItem,
                        eq(collectionItem.catalogItemId, catalogItem.id)
                    )
                    .leftJoin(progress, myProgress(me))
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
        '/:id/catalog',
        schemaValidator('param', CollectionParamSchema),
        schemaValidator('query', CatalogQuerySchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { q, seriesId, ...pageQuery } = c.req.valid('query');
            await requireMember(id, c.get('user').id);

            const terms = searchTerms(q ?? '');
            const page = await paginate(pageQuery, (limit, offset) =>
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
                    .where(
                        and(
                            seriesId
                                ? eq(catalogItem.seriesId, seriesId)
                                : undefined,
                            matchesAllTerms(terms, {
                                columns: [catalogItem.title],
                                position: catalogItem.position,
                            })
                        )
                    )
                    .orderBy(
                        ...(terms.length
                            ? [
                                  desc(
                                      relevance(terms.join(' '), [
                                          catalogItem.title,
                                      ])
                                  ),
                              ]
                            : []),
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
    .get(
        '/:id/items/:itemId',
        schemaValidator('param', ItemParamSchema),
        async (c) => {
            const { id, itemId } = c.req.valid('param');
            const me = c.get('user').id;
            await requireMember(id, me);

            const found = await db().query.collectionItem.findFirst({
                columns: { id: true },
                where: and(
                    eq(collectionItem.id, itemId),
                    eq(collectionItem.collectionId, id)
                ),
                with: { catalogItem: { with: { series: true } } },
            });
            if (!found) {
                throw new HTTPException(404, { message: 'Item not found' });
            }
            const item = found.catalogItem;

            const details = itemDetails(item);
            const [[mine], reviews] = await Promise.all([
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
                // Everyone else in the collection who finished it and left a
                // rating or review.
                db()
                    .select({
                        ...userColumns,
                        rating: progress.rating,
                        review: progress.review,
                    })
                    .from(collectionMember)
                    .innerJoin(user, eq(user.id, collectionMember.userId))
                    .innerJoin(
                        progress,
                        and(
                            eq(progress.userId, collectionMember.userId),
                            eq(progress.catalogItemId, item.id)
                        )
                    )
                    .where(
                        and(
                            eq(collectionMember.collectionId, id),
                            ne(collectionMember.userId, me),
                            isCompleted,
                            or(
                                isNotNull(progress.rating),
                                isNotNull(progress.review)
                            )
                        )
                    )
                    .orderBy(desc(progress.updatedAt), asc(user.id)),
            ]);

            return c.json({
                id: found.id,
                catalogItemId: item.id,
                format: item.format,
                kind: item.kind,
                title: item.title,
                coverUrl: item.coverUrl,
                position: item.position,
                seriesId: item.series?.id ?? null,
                seriesTitle: item.series?.title ?? null,
                ...details,
                status: mine?.status ?? null,
                rating: mine?.rating ?? null,
                review: mine?.review ?? null,
                reviews,
            });
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
    )
    .get(
        '/:id/members',
        schemaValidator('param', CollectionParamSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            await requireMember(id, c.get('user').id);

            const members = await db()
                .select({ ...userColumns, role: collectionMember.role })
                .from(collectionMember)
                .innerJoin(user, eq(user.id, collectionMember.userId))
                .where(eq(collectionMember.collectionId, id))
                .orderBy(...ownerFirst, asc(user.id));
            return c.json(members);
        }
    )
    .delete(
        '/:id/members/:userId',
        schemaValidator('param', MemberParamSchema),
        async (c) => {
            const { id, userId } = c.req.valid('param');
            const me = c.get('user').id;
            const leaving = userId.toLowerCase() === me;

            // Editors can leave; only the owner removes other people.
            const role = await requireMember(
                id,
                me,
                leaving ? undefined : CollectionRole.Owner
            );
            if (leaving && role === CollectionRole.Owner) {
                throw new HTTPException(400, {
                    message:
                        "Owners can't leave. Delete the collection instead.",
                });
            }

            const [removed] = await db()
                .delete(collectionMember)
                .where(
                    and(
                        eq(collectionMember.collectionId, id),
                        eq(collectionMember.userId, userId),
                        eq(collectionMember.role, CollectionRole.Editor)
                    )
                )
                .returning({ userId: collectionMember.userId });
            if (!removed) {
                throw new HTTPException(404, { message: 'Member not found' });
            }
            return c.body(null, 204);
        }
    )
    .get(
        '/:id/invites',
        schemaValidator('param', CollectionParamSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            await requireMember(id, c.get('user').id, CollectionRole.Owner);

            const invited = await db()
                .select(userColumns)
                .from(collectionInvite)
                .innerJoin(user, eq(user.id, collectionInvite.inviteeId))
                .where(eq(collectionInvite.collectionId, id))
                .orderBy(asc(collectionInvite.createdAt), asc(user.id));
            return c.json(invited);
        }
    )
    .post(
        '/:id/invites',
        schemaValidator('param', CollectionParamSchema),
        schemaValidator('json', UserIdSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { userId } = c.req.valid('json');
            const me = c.get('user').id;
            await requireMember(id, me, CollectionRole.Owner);

            if (!(await areFriends(me, userId))) {
                throw new HTTPException(400, {
                    message: 'You can only invite friends',
                });
            }
            const member = await db().query.collectionMember.findFirst({
                columns: { role: true },
                where: and(
                    eq(collectionMember.collectionId, id),
                    eq(collectionMember.userId, userId)
                ),
            });
            if (member) {
                throw new HTTPException(409, {
                    message: 'Already a member',
                });
            }

            const [invited] = await db()
                .insert(collectionInvite)
                .values({ collectionId: id, inviteeId: userId, inviterId: me })
                .onConflictDoNothing()
                .returning({ inviteeId: collectionInvite.inviteeId });
            if (!invited) {
                throw new HTTPException(409, { message: 'Already invited' });
            }
            return c.json(invited, 201);
        }
    )
    .delete(
        '/:id/invites/:userId',
        schemaValidator('param', MemberParamSchema),
        async (c) => {
            const { id, userId } = c.req.valid('param');
            await requireMember(id, c.get('user').id, CollectionRole.Owner);

            const [removed] = await db()
                .delete(collectionInvite)
                .where(
                    and(
                        eq(collectionInvite.collectionId, id),
                        eq(collectionInvite.inviteeId, userId)
                    )
                )
                .returning({ inviteeId: collectionInvite.inviteeId });
            if (!removed) {
                throw new HTTPException(404, { message: 'Invite not found' });
            }
            return c.body(null, 204);
        }
    )
    .get(
        '/:id/invitable-friends',
        schemaValidator('param', CollectionParamSchema),
        schemaValidator('query', FriendsQuerySchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { q, ...pageQuery } = c.req.valid('query');
            const me = c.get('user').id;
            await requireMember(id, me, CollectionRole.Owner);
            const pattern = q ? likePattern(q) : undefined;

            // My friends who aren't in the collection or invited to it yet.
            const page = await paginate(pageQuery, (limit, offset) =>
                db()
                    .select(userColumns)
                    .from(user)
                    .innerJoin(friendship, friendshipWith(me, user.id))
                    .where(
                        and(
                            notExists(
                                db()
                                    .select({ userId: collectionMember.userId })
                                    .from(collectionMember)
                                    .where(
                                        and(
                                            eq(
                                                collectionMember.collectionId,
                                                id
                                            ),
                                            eq(collectionMember.userId, user.id)
                                        )
                                    )
                            ),
                            notExists(
                                db()
                                    .select({
                                        inviteeId: collectionInvite.inviteeId,
                                    })
                                    .from(collectionInvite)
                                    .where(
                                        and(
                                            eq(
                                                collectionInvite.collectionId,
                                                id
                                            ),
                                            eq(
                                                collectionInvite.inviteeId,
                                                user.id
                                            )
                                        )
                                    )
                            ),
                            pattern
                                ? or(
                                      ilike(user.name, pattern),
                                      ilike(user.username, pattern)
                                  )
                                : undefined
                        )
                    )
                    .orderBy(sql`lower(${user.name})`, asc(user.id))
                    .limit(limit)
                    .offset(offset)
            );
            return c.json(page);
        }
    );

export default collections;
