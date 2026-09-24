import { CollectionRole } from '@analog/types';

import type { Database } from '../index.js';
import {
    account,
    collection,
    collectionInvite,
    collectionMember,
    friendRequest,
    friendship,
    user,
} from '../schema/index.js';
import { and, eq } from 'drizzle-orm';

// Sample people with no password, so nobody can sign in as them.
const ada = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Ada Lovelace',
};
const grace = {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Grace Hopper',
};
const alan = {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Alan Turing',
};
const katherine = {
    id: '00000000-0000-4000-8000-000000000004',
    name: 'Katherine Johnson',
};
const SEED_USERS = [ada, grace, alan, katherine];
const SEED_COLLECTION_ID = '00000000-0000-4000-8000-000000000101';

function friendPair(userId: string, otherId: string) {
    return userId < otherId
        ? { userAId: userId, userBId: otherId }
        : { userAId: otherId, userBId: userId };
}

/**
 * Local dev seed. Idempotent: safe to run on every `pnpm local:up`.
 * Add inserts here as tables land, using `onConflictDoNothing()`.
 *
 * Every real account gets two sample friends, a friend request from Alan
 * (until they're friends) and an invite to Ada's collection (until they
 * join). Katherine is only there to be found in search.
 */
export async function runSeed(db: Database): Promise<void> {
    await db
        .insert(user)
        .values(
            SEED_USERS.map(({ id, name }) => ({
                id,
                name,
                username: name.toLowerCase().replace(/\s+/g, '.'),
                email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
                emailVerified: true,
            }))
        )
        .onConflictDoNothing();

    await db
        .insert(collection)
        .values({ id: SEED_COLLECTION_ID, name: "Ada's Shelf" })
        .onConflictDoNothing();
    await db
        .insert(collectionMember)
        .values({
            collectionId: SEED_COLLECTION_ID,
            userId: ada.id,
            role: CollectionRole.Owner,
        })
        .onConflictDoNothing();

    const realUsers = await db
        .selectDistinct({ id: account.userId })
        .from(account);

    for (const { id } of realUsers) {
        await db
            .insert(friendship)
            .values([friendPair(id, ada.id), friendPair(id, grace.id)])
            .onConflictDoNothing();

        const alanPair = friendPair(id, alan.id);
        const [friendsWithAlan] = await db
            .select({ createdAt: friendship.createdAt })
            .from(friendship)
            .where(
                and(
                    eq(friendship.userAId, alanPair.userAId),
                    eq(friendship.userBId, alanPair.userBId)
                )
            );
        if (!friendsWithAlan) {
            await db
                .insert(friendRequest)
                .values({ senderId: alan.id, recipientId: id })
                .onConflictDoNothing();
        }

        const [member] = await db
            .select({ role: collectionMember.role })
            .from(collectionMember)
            .where(
                and(
                    eq(collectionMember.collectionId, SEED_COLLECTION_ID),
                    eq(collectionMember.userId, id)
                )
            );
        if (!member) {
            await db
                .insert(collectionInvite)
                .values({
                    collectionId: SEED_COLLECTION_ID,
                    inviteeId: id,
                    inviterId: ada.id,
                })
                .onConflictDoNothing();
        }
    }
}
