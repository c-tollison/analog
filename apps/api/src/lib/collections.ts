import { alias, and, eq, isNotNull, or, schema } from '@analog/db';
import { CollectionRole } from '@analog/types';

import { isFriendOf } from './friends.js';
import { db } from './init.js';
import { HTTPException } from 'hono/http-exception';

type Role = (typeof schema.collectionMember.$inferSelect)['role'];

const { collection, collectionMember, user } = schema;

// Joined by collection queries that visitors can see: the owner's member
// row, the owner, and the signed-in user's member row if they have one.
export const ownerMember = alias(collectionMember, 'owner_member');
export const owner = alias(user, 'owner');
export const myMember = alias(collectionMember, 'my_member');

export const isOwnerMember = and(
    eq(ownerMember.collectionId, collection.id),
    eq(ownerMember.role, CollectionRole.Owner)
);

export function isMyMember(userId: string) {
    return and(
        eq(myMember.collectionId, collection.id),
        eq(myMember.userId, userId)
    );
}

/**
 * The user can see the collection: they're a member, or it's public and the
 * owner's profile is public or they're friends. Needs `ownerMember`, `owner`
 * and `myMember` joined.
 */
export function canSeeCollection(userId: string) {
    return or(
        isNotNull(myMember.userId),
        and(
            eq(collection.isPublic, true),
            or(eq(owner.isPublic, true), isFriendOf(userId, owner.id))
        )
    );
}

/**
 * Returns the user's role in a collection. Non-members get a 404 so we don't
 * reveal which collection ids exist.
 */
export async function requireMember(
    collectionId: string,
    userId: string,
    requiredRole?: Role
): Promise<Role> {
    const member = await db().query.collectionMember.findFirst({
        columns: { role: true },
        where: and(
            eq(collectionMember.collectionId, collectionId),
            eq(collectionMember.userId, userId)
        ),
    });
    if (!member) {
        throw new HTTPException(404, { message: 'Collection not found' });
    }
    if (requiredRole && member.role !== requiredRole) {
        throw new HTTPException(403, {
            message: `Only the collection ${requiredRole} can do that`,
        });
    }
    return member.role;
}

/**
 * For pages visitors can read too. `role` is null for a visitor, and
 * `progressUserId` is whose progress the pages show: the user's own for a
 * member, the owner's for a visitor. Anyone who can't see it gets a 404.
 */
export async function requireViewer(collectionId: string, userId: string) {
    const [found] = await db()
        .select({ role: myMember.role, ownerId: owner.id })
        .from(collection)
        .innerJoin(ownerMember, isOwnerMember)
        .innerJoin(owner, eq(owner.id, ownerMember.userId))
        .leftJoin(myMember, isMyMember(userId))
        .where(and(eq(collection.id, collectionId), canSeeCollection(userId)));
    if (!found) {
        throw new HTTPException(404, { message: 'Collection not found' });
    }
    return {
        role: found.role,
        progressUserId: found.role ? userId : found.ownerId,
    };
}
