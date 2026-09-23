import { and, type Column, eq, type SQL, schema, sql } from '@analog/db';
import { Relationship } from '@analog/types';

import { db } from './init.js';

const { friendship, friendRequest, user } = schema;

/**
 * The friendship row for two users: smaller id first. Lowercased so string
 * order matches Postgres uuid order.
 */
export function friendPair(userId: string, otherId: string) {
    const [a, b] = [userId.toLowerCase(), otherId.toLowerCase()];
    return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

/** Join condition: `friendship` is a row between `userId` and `otherId`. */
export function friendshipWith(userId: string, otherId: Column | SQL): SQL {
    return sql`(
        (${friendship.userAId} = ${userId} and ${friendship.userBId} = ${otherId})
        or (${friendship.userBId} = ${userId} and ${friendship.userAId} = ${otherId})
    )`;
}

export async function areFriends(
    userId: string,
    otherId: string
): Promise<boolean> {
    const pair = friendPair(userId, otherId);
    const [found] = await db()
        .select({ createdAt: friendship.createdAt })
        .from(friendship)
        .where(
            and(
                eq(friendship.userAId, pair.userAId),
                eq(friendship.userBId, pair.userBId)
            )
        );
    return found !== undefined;
}

/** How `userId` relates to each row's `user.id`, for user lists. */
export function relationshipTo(userId: string): SQL<Relationship> {
    const me = sql`${userId}::uuid`;
    return sql<Relationship>`case
        when ${user.id} = ${me} then ${Relationship.Self}
        when exists (
            select 1 from ${friendship}
            where ${friendship.userAId} = least(${me}, ${user.id})
              and ${friendship.userBId} = greatest(${me}, ${user.id})
        ) then ${Relationship.Friends}
        when exists (
            select 1 from ${friendRequest}
            where ${friendRequest.senderId} = ${me}
              and ${friendRequest.recipientId} = ${user.id}
        ) then ${Relationship.RequestSent}
        when exists (
            select 1 from ${friendRequest}
            where ${friendRequest.senderId} = ${user.id}
              and ${friendRequest.recipientId} = ${me}
        ) then ${Relationship.RequestReceived}
        else ${Relationship.None}
    end`;
}

export const userColumns = {
    id: user.id,
    name: user.name,
    username: user.username,
    image: user.image,
};
