import { asc, desc, eq, ilike, or, schema, sql } from '@analog/db';
import {
    MergeNameSchema,
    NameListQuerySchema,
    NameSearchQuerySchema,
    SetParentPublisherSchema,
    UpdateNameSchema,
} from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { mergedValues, namedValues } from '../lib/book-values.js';
import { db } from '../lib/init.js';
import { likePattern, paginate, paginateWithTotal } from '../lib/pagination.js';
import { IdParamSchema } from '../lib/params.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

const { catalogItem, catalogItemIsbn, publisher } = schema;

// Matches the name or any other spelling.
function nameMatching(q: string) {
    const pattern = likePattern(q);
    return or(
        ilike(publisher.name, pattern),
        ilike(sql`array_to_string(${publisher.aliases}, ' ')`, pattern)
    );
}

async function requirePublisher(id: string) {
    const found = await db().query.publisher.findFirst({
        where: eq(publisher.id, id),
    });
    if (!found) {
        throw new HTTPException(404, { message: 'Publisher not found' });
    }
    return found;
}

// Who published each ISBN: picking one, and fixing names.
const adminPublishers = new Hono<AppEnv>()
    .get('/', schemaValidator('query', NameListQuerySchema), async (c) => {
        const { q, ...page } = c.req.valid('query');
        const where = q ? nameMatching(q) : undefined;
        const uses = db()
            .select({
                publisherId: catalogItemIsbn.publisherId,
                count: sql<number>`count(*)::int`.as('count'),
            })
            .from(catalogItemIsbn)
            .groupBy(catalogItemIsbn.publisherId)
            .as('uses');
        return c.json(
            await paginateWithTotal(
                page,
                (limit, offset) =>
                    db()
                        .select({
                            id: publisher.id,
                            name: publisher.name,
                            aliases: publisher.aliases,
                            uses: sql<number>`coalesce(${uses.count}, 0)::int`,
                        })
                        .from(publisher)
                        .leftJoin(uses, eq(uses.publisherId, publisher.id))
                        .where(where)
                        .orderBy(asc(publisher.name), asc(publisher.id))
                        .limit(limit)
                        .offset(offset),
                () => db().$count(publisher, where)
            )
        );
    })
    // Registered before /:id, which would take "search" as an id.
    .get(
        '/search',
        schemaValidator('query', NameSearchQuerySchema),
        async (c) => {
            const { q, ...page } = c.req.valid('query');
            return c.json(
                await paginate(page, (limit, offset) =>
                    db()
                        .select({ id: publisher.id, name: publisher.name })
                        .from(publisher)
                        .where(nameMatching(q))
                        .orderBy(
                            desc(sql`lower(${publisher.name}) = lower(${q})`),
                            asc(publisher.name)
                        )
                        .limit(limit)
                        .offset(offset)
                )
            );
        }
    )
    .get('/:id', schemaValidator('param', IdParamSchema), async (c) => {
        const found = await requirePublisher(c.req.valid('param').id);
        const uses = await db()
            .select({
                id: catalogItem.id,
                title: sql<string>`coalesce(${catalogItemIsbn.title}, ${catalogItem.title})`,
                detail: catalogItemIsbn.isbn,
            })
            .from(catalogItemIsbn)
            .innerJoin(
                catalogItem,
                eq(catalogItem.id, catalogItemIsbn.catalogItemId)
            )
            .where(eq(catalogItemIsbn.publisherId, found.id))
            .orderBy(asc(catalogItem.title), asc(catalogItemIsbn.isbn));
        const [parent, imprints] = await Promise.all([
            found.parentId
                ? db().query.publisher.findFirst({
                      columns: { id: true, name: true },
                      where: eq(publisher.id, found.parentId),
                  })
                : undefined,
            db()
                .select({ id: publisher.id, name: publisher.name })
                .from(publisher)
                .where(eq(publisher.parentId, found.id))
                .orderBy(asc(publisher.name)),
        ]);
        return c.json({
            id: found.id,
            name: found.name,
            aliases: found.aliases,
            parent: parent ?? null,
            imprints,
            uses,
        });
    })
    // Makes this publisher an imprint of another, or not one with null.
    .put(
        '/:id/parent',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', SetParentPublisherSchema),
        async (c) => {
            const found = await requirePublisher(c.req.valid('param').id);
            const { parentId } = c.req.valid('json');
            // Walks up from the new parent, so no publisher ends up above
            // itself.
            let above = parentId ? await requirePublisher(parentId) : null;
            while (above) {
                if (above.id === found.id) {
                    throw new HTTPException(400, {
                        message: "A publisher can't be an imprint of itself",
                    });
                }
                above = above.parentId
                    ? await requirePublisher(above.parentId)
                    : null;
            }
            await db()
                .update(publisher)
                .set({ parentId, updatedAt: new Date() })
                .where(eq(publisher.id, found.id));
            return c.body(null, 204);
        }
    )
    .put(
        '/:id',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', UpdateNameSchema),
        async (c) => {
            const found = await requirePublisher(c.req.valid('param').id);
            const { name, aliases } = c.req.valid('json');
            await db()
                .update(publisher)
                .set({ ...namedValues(name, aliases), updatedAt: new Date() })
                .where(eq(publisher.id, found.id));
            return c.body(null, 204);
        }
    )
    // Moves every ISBN to the other publisher, which also takes this one's
    // spellings, then deletes this one.
    .post(
        '/:id/merge',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', MergeNameSchema),
        async (c) => {
            const from = await requirePublisher(c.req.valid('param').id);
            const into = await requirePublisher(c.req.valid('json').intoId);
            if (from.id === into.id) {
                throw new HTTPException(400, {
                    message: "Can't merge a publisher into itself",
                });
            }
            await db().transaction(async (tx) => {
                // Its imprints move too. One that was the other publisher's
                // parent stops being one.
                await tx
                    .update(publisher)
                    .set({ parentId: into.id })
                    .where(eq(publisher.parentId, from.id));
                if (into.parentId === from.id) {
                    await tx
                        .update(publisher)
                        .set({
                            parentId:
                                from.parentId === into.id
                                    ? null
                                    : from.parentId,
                        })
                        .where(eq(publisher.id, into.id));
                }
                await tx
                    .update(catalogItemIsbn)
                    .set({ publisherId: into.id })
                    .where(eq(catalogItemIsbn.publisherId, from.id));
                await tx
                    .update(publisher)
                    .set({ ...mergedValues(into, from), updatedAt: new Date() })
                    .where(eq(publisher.id, into.id));
                await tx.delete(publisher).where(eq(publisher.id, from.id));
            });
            return c.body(null, 204);
        }
    );

export default adminPublishers;
