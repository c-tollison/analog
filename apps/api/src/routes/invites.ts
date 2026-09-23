import { and, eq, schema } from '@analog/db';
import { CollectionRole } from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { db } from '../lib/init.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const { collectionInvite, collectionMember } = schema;

const InviteParamSchema = z.object({ collectionId: z.uuid('Invalid id') });

function myInvite(collectionId: string, userId: string) {
    return and(
        eq(collectionInvite.collectionId, collectionId),
        eq(collectionInvite.inviteeId, userId)
    );
}

const invites = new Hono<AppEnv>()
    .post(
        '/:collectionId/accept',
        schemaValidator('param', InviteParamSchema),
        async (c) => {
            const { collectionId } = c.req.valid('param');
            const me = c.get('user').id;

            await db().transaction(async (tx) => {
                const removed = await tx
                    .delete(collectionInvite)
                    .where(myInvite(collectionId, me))
                    .returning({ createdAt: collectionInvite.createdAt });
                if (!removed.length) {
                    throw new HTTPException(404, {
                        message: 'Invite not found',
                    });
                }
                await tx
                    .insert(collectionMember)
                    .values({
                        collectionId,
                        userId: me,
                        role: CollectionRole.Editor,
                    })
                    .onConflictDoNothing();
            });

            return c.body(null, 204);
        }
    )
    .delete(
        '/:collectionId',
        schemaValidator('param', InviteParamSchema),
        async (c) => {
            const { collectionId } = c.req.valid('param');
            const removed = await db()
                .delete(collectionInvite)
                .where(myInvite(collectionId, c.get('user').id))
                .returning({ createdAt: collectionInvite.createdAt });
            if (!removed.length) {
                throw new HTTPException(404, { message: 'Invite not found' });
            }
            return c.body(null, 204);
        }
    );

export default invites;
