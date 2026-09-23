import { eq, schema, sql } from '@analog/db';
import { NotificationKind, PageQuerySchema } from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { db } from '../lib/init.js';
import { paginate } from '../lib/pagination.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';

const { collection, collectionInvite, friendRequest, user } = schema;

const notifications = new Hono<AppEnv>()
    .get('/', schemaValidator('query', PageQuerySchema), async (c) => {
        const me = c.get('user').id;

        const page = await paginate(c.req.valid('query'), (limit, offset) => {
            const requests = db()
                .select({
                    kind: sql<NotificationKind>`${NotificationKind.FriendRequest}::text`.as(
                        'kind'
                    ),
                    userId: user.id,
                    name: user.name,
                    username: user.username,
                    image: user.image,
                    collectionId: sql<string | null>`null::uuid`.as(
                        'collection_id'
                    ),
                    collectionName: sql<string | null>`null::text`.as(
                        'collection_name'
                    ),
                    createdAt: friendRequest.createdAt,
                })
                .from(friendRequest)
                .innerJoin(user, eq(user.id, friendRequest.senderId))
                .where(eq(friendRequest.recipientId, me));

            const invites = db()
                .select({
                    kind: sql<NotificationKind>`${NotificationKind.CollectionInvite}::text`.as(
                        'kind'
                    ),
                    userId: user.id,
                    name: user.name,
                    username: user.username,
                    image: user.image,
                    collectionId: sql<string | null>`${collection.id}`.as(
                        'collection_id'
                    ),
                    collectionName: sql<string | null>`${collection.name}`.as(
                        'collection_name'
                    ),
                    createdAt: collectionInvite.createdAt,
                })
                .from(collectionInvite)
                .innerJoin(user, eq(user.id, collectionInvite.inviterId))
                .innerJoin(
                    collection,
                    eq(collection.id, collectionInvite.collectionId)
                )
                .where(eq(collectionInvite.inviteeId, me));

            return requests
                .unionAll(invites)
                .orderBy(
                    sql`created_at desc`,
                    sql`kind`,
                    sql`id`,
                    sql`collection_id`
                )
                .limit(limit)
                .offset(offset);
        });
        return c.json(page);
    })
    .get('/count', async (c) => {
        const me = c.get('user').id;
        const [requests, invites] = await Promise.all([
            db().$count(friendRequest, eq(friendRequest.recipientId, me)),
            db().$count(collectionInvite, eq(collectionInvite.inviteeId, me)),
        ]);
        return c.json({ count: requests + invites });
    });

export default notifications;
