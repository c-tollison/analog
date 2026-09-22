import { and, eq, schema } from '@analog/db';

import { db } from './init.js';
import { HTTPException } from 'hono/http-exception';

type Role = (typeof schema.collectionMember.$inferSelect)['role'];

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
            eq(schema.collectionMember.collectionId, collectionId),
            eq(schema.collectionMember.userId, userId)
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
