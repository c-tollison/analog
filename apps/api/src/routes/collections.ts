import {
    and,
    asc,
    desc,
    eq,
    ilike,
    isNotNull,
    notExists,
    or,
    schema,
    sql,
} from '@analog/db';
import {
    AddBookSchema,
    CollectionRole,
    CollectionSort,
    CreateCollectionSchema,
    type MediaFormat,
    PageQuerySchema,
    type ProgressStatus,
    type SeriesKind,
    UpdateCollectionSchema,
    UserIdSchema,
} from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { lowestVolumeCover, seriesColumns } from '../lib/books.js';
import {
    canSeeCollection,
    collectionSummaries,
    completedCount,
    myMember,
    ownEdition,
    requireMember,
    requireViewer,
} from '../lib/collections.js';
import { visibleToVisitors } from '../lib/discovery.js';
import { upsertBook } from '../lib/editions.js';
import { areFriends, friendshipWith, userColumns } from '../lib/friends.js';
import { db } from '../lib/init.js';
import { likePattern, paginate } from '../lib/pagination.js';
import { IdParamSchema } from '../lib/params.js';
import { whenCompleted } from '../lib/progress.js';
import { matchesAllTerms, relevance, searchTerms } from '../lib/search.js';
import { seriesDetails } from '../lib/series-details.js';
import { schemaValidator } from '../lib/validator.js';
import collectionItems, { collectionEditions } from './collection-items.js';
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
function progressOf(userId: string) {
    return and(
        eq(progress.catalogItemId, catalogItem.id),
        eq(progress.userId, userId)
    );
}

const myRating = whenCompleted<number>(progress.rating);

const CollectionParamSchema = IdParamSchema;
const MemberParamSchema = CollectionParamSchema.extend({
    userId: z.uuid('Invalid id'),
});
const SeriesParamSchema = CollectionParamSchema.extend({
    seriesId: z.uuid('Invalid id'),
});
const EntriesQuerySchema = PageQuerySchema.extend({
    sort: z.enum(CollectionSort).default(CollectionSort.Name),
});
const SearchQuerySchema = PageQuerySchema.extend({
    q: z.string().trim().min(1).max(200),
});
const FriendsQuerySchema = PageQuerySchema.extend({
    q: z.string().trim().max(100).optional(),
});

const itemColumns = {
    id: collectionItem.id,
    catalogItemId: catalogItem.id,
    format: catalogItem.format,
    kind: catalogItem.kind,
    title: catalogItem.title,
    coverUrl: catalogItem.coverUrl,
    position: catalogItem.position,
};

const ownerFirst = [
    sql`${collectionMember.role} = ${CollectionRole.Owner} desc`,
    asc(collectionMember.createdAt),
];

const collections = new Hono<AppEnv>()
    .get('/', schemaValidator('query', PageQuerySchema), async (c) => {
        const user = c.get('user');
        const page = await paginate(c.req.valid('query'), (limit, offset) =>
            collectionSummaries(user.id, isNotNull(myMember.userId))
                .limit(limit)
                .offset(offset)
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
                throw new Error('Failed to create shelf');
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
        const me = c.get('user').id;
        const [found] = await collectionSummaries(
            me,
            and(eq(collection.id, id), canSeeCollection(me))
        );
        if (!found) {
            throw new HTTPException(404, { message: 'Shelf not found' });
        }
        return c.json(found);
    })
    .patch(
        '/:id',
        schemaValidator('param', CollectionParamSchema),
        schemaValidator('json', UpdateCollectionSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const values = c.req.valid('json');
            await requireMember(id, c.get('user').id, CollectionRole.Owner);
            await db()
                .update(collection)
                .set(values)
                .where(eq(collection.id, id));
            return c.json(values);
        }
    )
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
            const { sort, ...pageQuery } = c.req.valid('query');
            const { role, progressUserId } = await requireViewer(
                id,
                c.get('user').id
            );
            const visible = role ? undefined : visibleToVisitors();

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
                        // Only meaningful for items not in a series.
                        catalogItemId: sql<string>`min(${catalogItem.id}::text)`,
                        format: sql<MediaFormat>`min(${catalogItem.format}::text)`,
                        kind: sql<SeriesKind | null>`min(${catalogItem.kind}::text)`,
                        title: itemTitle,
                        coverUrl: lowestVolumeCover,
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
                    .leftJoin(progress, progressOf(progressUserId))
                    .where(and(eq(collectionItem.collectionId, id), visible))
                    .groupBy(groupKey, series.id)
                    .orderBy(
                        ...(sort === CollectionSort.Newest
                            ? [desc(sql`max(${collectionItem.createdAt})`)]
                            : []),
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
            const { role, progressUserId } = await requireViewer(
                id,
                c.get('user').id
            );

            const [found, [counted]] = await Promise.all([
                db().query.series.findFirst({
                    where: eq(series.id, seriesId),
                }),
                db()
                    .select({
                        ownedCount: sql<number>`count(*)::int`,
                        completedCount,
                        coverUrl: lowestVolumeCover,
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
                    .leftJoin(series, eq(catalogItem.seriesId, series.id))
                    .leftJoin(progress, progressOf(progressUserId))
                    .where(
                        and(
                            eq(collectionItem.collectionId, id),
                            eq(catalogItem.seriesId, seriesId),
                            role ? undefined : visibleToVisitors()
                        )
                    ),
            ]);
            if (!found || (!role && !found.verifiedAt)) {
                throw new HTTPException(404, { message: 'Series not found' });
            }

            return c.json({
                series: {
                    id: found.id,
                    title: found.title,
                    kind: found.kind,
                    coverUrl: counted?.coverUrl ?? found.coverUrl,
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
            const { role, progressUserId } = await requireViewer(
                id,
                c.get('user').id
            );

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
                    .leftJoin(series, eq(catalogItem.seriesId, series.id))
                    .leftJoin(progress, progressOf(progressUserId))
                    .where(
                        and(
                            eq(collectionItem.collectionId, id),
                            eq(catalogItem.seriesId, seriesId),
                            role ? undefined : visibleToVisitors()
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
    .post(
        '/:id/books',
        schemaValidator('param', CollectionParamSchema),
        schemaValidator('json', AddBookSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { isbn, series: seriesChoice, volume } = c.req.valid('json');
            const user = c.get('user');
            await requireMember(id, user.id);

            const item = await upsertBook(isbn, seriesChoice, volume, {
                userId: user.id,
                admin: false,
            });

            // A collection holds each volume once. Another edition of one it
            // already has joins that entry.
            const { entryId, isNew } = await ownEdition(
                id,
                item.id,
                isbn,
                user.id
            );
            if (!isNew) {
                throw new HTTPException(409, {
                    message: 'Already on this shelf',
                });
            }

            return c.json({ id: entryId, seriesId: item.seriesId }, 201);
        }
    )
    .route('/:id/items', collectionItems)
    .route('/:id/editions', collectionEditions)
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
                    message: "Owners can't leave. Delete the shelf instead.",
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
