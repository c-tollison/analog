import { and, asc, eq, ilike, inArray, or, schema, sql } from '@analog/db';
import {
    CollectionRole,
    PageQuerySchema,
    Relationship,
    UserIdSchema,
} from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import {
    areFriends,
    friendPair,
    friendshipWith,
    userColumns,
} from '../lib/friends.js';
import { db } from '../lib/init.js';
import { likePattern, paginate } from '../lib/pagination.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const {
    collection,
    collectionInvite,
    collectionMember,
    friendRequest,
    friendship,
    user,
} = schema;

const FriendsQuerySchema = PageQuerySchema.extend({
    q: z.string().trim().max(100).optional(),
});

async function requireFriend(userId: string, otherId: string) {
    if (!(await areFriends(userId, otherId))) {
        throw new HTTPException(404, { message: 'Friend not found' });
    }
}

const friends = new Hono<AppEnv>()
    .get('/', schemaValidator('query', FriendsQuerySchema), async (c) => {
        const { q, ...pageQuery } = c.req.valid('query');
        const me = c.get('user').id;
        const pattern = q ? likePattern(q) : undefined;

        const page = await paginate(pageQuery, (limit, offset) =>
            db()
                .select(userColumns)
                .from(user)
                .innerJoin(friendship, friendshipWith(me, user.id))
                .where(
                    pattern
                        ? or(
                              ilike(user.name, pattern),
                              ilike(user.username, pattern)
                          )
                        : undefined
                )
                .orderBy(sql`lower(${user.name})`, asc(user.id))
                .limit(limit)
                .offset(offset)
        );
        return c.json(page);
    })
    .delete('/:userId', schemaValidator('param', UserIdSchema), async (c) => {
        const { userId } = c.req.valid('param');
        const me = c.get('user').id;
        const pair = friendPair(me, userId);

        await db().transaction(async (tx) => {
            const removed = await tx
                .delete(friendship)
                .where(
                    and(
                        eq(friendship.userAId, pair.userAId),
                        eq(friendship.userBId, pair.userBId)
                    )
                )
                .returning({ createdAt: friendship.createdAt });
            if (!removed.length) {
                throw new HTTPException(404, { message: 'Friend not found' });
            }
            // Invites are friends-only, so pending ones between the two go.
            await tx
                .delete(collectionInvite)
                .where(
                    or(
                        and(
                            eq(collectionInvite.inviterId, me),
                            eq(collectionInvite.inviteeId, userId)
                        ),
                        and(
                            eq(collectionInvite.inviterId, userId),
                            eq(collectionInvite.inviteeId, me)
                        )
                    )
                );
            // Each loses editor access to the other's collections.
            const ownedBy = (ownerId: string) =>
                tx
                    .select({ id: collectionMember.collectionId })
                    .from(collectionMember)
                    .where(
                        and(
                            eq(collectionMember.userId, ownerId),
                            eq(collectionMember.role, CollectionRole.Owner)
                        )
                    );
            await tx
                .delete(collectionMember)
                .where(
                    and(
                        eq(collectionMember.role, CollectionRole.Editor),
                        or(
                            and(
                                eq(collectionMember.userId, userId),
                                inArray(
                                    collectionMember.collectionId,
                                    ownedBy(me)
                                )
                            ),
                            and(
                                eq(collectionMember.userId, me),
                                inArray(
                                    collectionMember.collectionId,
                                    ownedBy(userId)
                                )
                            )
                        )
                    )
                );
        });

        return c.body(null, 204);
    })
    .get(
        '/:userId/collections',
        schemaValidator('param', UserIdSchema),
        schemaValidator('query', PageQuerySchema),
        async (c) => {
            const { userId } = c.req.valid('param');
            const me = c.get('user').id;
            await requireFriend(me, userId);

            // The collections I own, and whether this friend is in or
            // invited to each.
            const page = await paginate(c.req.valid('query'), (limit, offset) =>
                db()
                    .select({
                        id: collection.id,
                        name: collection.name,
                        isMember: sql<boolean>`exists (
                            select 1 from ${collectionMember} m
                            where m.collection_id = ${collection.id}
                              and m.user_id = ${userId}
                        )`,
                        isInvited: sql<boolean>`exists (
                            select 1 from ${collectionInvite} i
                            where i.collection_id = ${collection.id}
                              and i.invitee_id = ${userId}
                        )`,
                    })
                    .from(collectionMember)
                    .innerJoin(
                        collection,
                        eq(collection.id, collectionMember.collectionId)
                    )
                    .where(
                        and(
                            eq(collectionMember.userId, me),
                            eq(collectionMember.role, CollectionRole.Owner)
                        )
                    )
                    .orderBy(sql`lower(${collection.name})`, asc(collection.id))
                    .limit(limit)
                    .offset(offset)
            );
            return c.json(page);
        }
    )
    .post('/requests', schemaValidator('json', UserIdSchema), async (c) => {
        const { userId } = c.req.valid('json');
        const me = c.get('user').id;
        if (userId.toLowerCase() === me) {
            throw new HTTPException(400, {
                message: "You can't add yourself",
            });
        }

        const [found] = await db()
            .select({ id: user.id })
            .from(user)
            .where(eq(user.id, userId));
        if (!found) {
            throw new HTTPException(404, { message: 'User not found' });
        }
        if (await areFriends(me, userId)) {
            throw new HTTPException(409, {
                message: 'You are already friends',
            });
        }

        // If they already asked me, sending one back accepts theirs.
        const relationship = await db().transaction(async (tx) => {
            const theirs = await tx
                .delete(friendRequest)
                .where(
                    and(
                        eq(friendRequest.senderId, userId),
                        eq(friendRequest.recipientId, me)
                    )
                )
                .returning({ createdAt: friendRequest.createdAt });
            if (theirs.length) {
                await tx
                    .insert(friendship)
                    .values(friendPair(me, userId))
                    .onConflictDoNothing();
                return Relationship.Friends;
            }

            const sent = await tx
                .insert(friendRequest)
                .values({ senderId: me, recipientId: userId })
                .onConflictDoNothing()
                .returning({ createdAt: friendRequest.createdAt });
            if (!sent.length) {
                throw new HTTPException(409, {
                    message: 'Request already sent',
                });
            }
            return Relationship.RequestSent;
        });

        return c.json({ relationship }, 201);
    })
    .delete(
        '/requests/sent/:userId',
        schemaValidator('param', UserIdSchema),
        async (c) => {
            const { userId } = c.req.valid('param');
            const removed = await db()
                .delete(friendRequest)
                .where(
                    and(
                        eq(friendRequest.senderId, c.get('user').id),
                        eq(friendRequest.recipientId, userId)
                    )
                )
                .returning({ createdAt: friendRequest.createdAt });
            if (!removed.length) {
                throw new HTTPException(404, { message: 'Request not found' });
            }
            return c.body(null, 204);
        }
    )
    .post(
        '/requests/received/:userId/accept',
        schemaValidator('param', UserIdSchema),
        async (c) => {
            const { userId } = c.req.valid('param');
            const me = c.get('user').id;

            await db().transaction(async (tx) => {
                const removed = await tx
                    .delete(friendRequest)
                    .where(
                        and(
                            eq(friendRequest.senderId, userId),
                            eq(friendRequest.recipientId, me)
                        )
                    )
                    .returning({ createdAt: friendRequest.createdAt });
                if (!removed.length) {
                    throw new HTTPException(404, {
                        message: 'Request not found',
                    });
                }
                await tx
                    .insert(friendship)
                    .values(friendPair(me, userId))
                    .onConflictDoNothing();
            });

            return c.body(null, 204);
        }
    )
    .delete(
        '/requests/received/:userId',
        schemaValidator('param', UserIdSchema),
        async (c) => {
            const { userId } = c.req.valid('param');
            const removed = await db()
                .delete(friendRequest)
                .where(
                    and(
                        eq(friendRequest.senderId, userId),
                        eq(friendRequest.recipientId, c.get('user').id)
                    )
                )
                .returning({ createdAt: friendRequest.createdAt });
            if (!removed.length) {
                throw new HTTPException(404, { message: 'Request not found' });
            }
            return c.body(null, 204);
        }
    );

export default friends;
