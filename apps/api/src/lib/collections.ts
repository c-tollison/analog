import {
    alias,
    and,
    asc,
    eq,
    isNotNull,
    or,
    type SQL,
    schema,
    sql,
} from '@analog/db';
import {
    CollectionRole,
    type MediaFormat,
    ProgressStatus,
} from '@analog/types';

import { visibleToVisitors } from './discovery.js';
import { isFriendOf } from './friends.js';
import { db } from './init.js';
import { HTTPException } from 'hono/http-exception';

type Role = (typeof schema.collectionMember.$inferSelect)['role'];

const {
    catalogItem,
    collection,
    collectionItem,
    collectionItemIsbn,
    collectionMember,
    progress,
    series,
    user,
} = schema;

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
        throw new HTTPException(404, { message: 'Shelf not found' });
    }
    if (requiredRole && member.role !== requiredRole) {
        throw new HTTPException(403, {
            message: `Only the shelf ${requiredRole} can do that`,
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
        throw new HTTPException(404, { message: 'Shelf not found' });
    }
    return {
        role: found.role,
        progressUserId: found.role ? userId : found.ownerId,
    };
}

/** Counts the joined progress rows that have `status`. */
function statusCount(status: ProgressStatus) {
    return sql<number>`(
        count(*) filter (where ${progress.status} = ${status})
    )::int`;
}

export const completedCount = statusCount(ProgressStatus.Completed);

const MEMBER_PREVIEW_COUNT = 3;

type MemberPreview = Pick<typeof user.$inferSelect, 'id' | 'name' | 'image'>;

/**
 * Item totals for each collection in the outer query, read in one pass over
 * its items: how many items and owned editions there are, the status counts
 * and the formats. Members get their own counts; visitors get the owner's and
 * only what they can see.
 */
function itemStats() {
    return db()
        .select({
            itemCount: sql<number>`count(*)::int`.as('item_count'),
            editionCount: sql<number>`coalesce(sum((
                select count(*) from ${collectionItemIsbn}
                where ${collectionItemIsbn.collectionItemId} = ${collectionItem.id}
            )), 0)::int`.as('edition_count'),
            completedCount: completedCount.as('completed_count'),
            inProgressCount: statusCount(ProgressStatus.InProgress).as(
                'in_progress_count'
            ),
            plannedCount: statusCount(ProgressStatus.Planned).as(
                'planned_count'
            ),
            formats: sql<MediaFormat[]>`coalesce(
                json_agg(distinct ${catalogItem.format}), '[]'::json
            )`.as('formats'),
        })
        .from(collectionItem)
        .innerJoin(
            catalogItem,
            eq(collectionItem.catalogItemId, catalogItem.id)
        )
        .leftJoin(series, eq(catalogItem.seriesId, series.id))
        .leftJoin(
            progress,
            and(
                eq(progress.catalogItemId, collectionItem.catalogItemId),
                eq(
                    progress.userId,
                    sql`coalesce(${myMember.userId}, ${ownerMember.userId})`
                )
            )
        )
        .where(
            and(
                eq(collectionItem.collectionId, collection.id),
                or(isNotNull(myMember.userId), visibleToVisitors())
            )
        )
        .as('item_stats');
}

/** Collections that match `where`, as `userId` sees them. */
export function collectionSummaries(userId: string, where: SQL | undefined) {
    const stats = itemStats();
    return db()
        .select({
            id: collection.id,
            name: collection.name,
            isPublic: collection.isPublic,
            role: myMember.role,
            ownerName: owner.name,
            ownerUsername: owner.username,
            itemCount: stats.itemCount,
            editionCount: stats.editionCount,
            completedCount: stats.completedCount,
            inProgressCount: stats.inProgressCount,
            plannedCount: stats.plannedCount,
            formats: stats.formats,
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
        .from(collection)
        .innerJoin(ownerMember, isOwnerMember)
        .innerJoin(owner, eq(owner.id, ownerMember.userId))
        .leftJoin(myMember, isMyMember(userId))
        .crossJoinLateral(stats)
        .where(where)
        .orderBy(sql`lower(${collection.name})`, asc(collection.id))
        .$dynamic();
}
