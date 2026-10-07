import { asc, desc, eq, ilike, or, schema, sql, unionAll } from '@analog/db';
import {
    MergeNameSchema,
    NameListQuerySchema,
    NameSearchQuerySchema,
    PERSON_ROLE_LABELS,
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

const {
    catalogItem,
    catalogItemIsbn,
    catalogItemIsbnPerson,
    catalogItemPerson,
    person,
} = schema;

// Every book each person is credited on, for the work or one edition.
function credits() {
    return unionAll(
        db()
            .select({
                personId: catalogItemPerson.personId,
                catalogItemId: catalogItemPerson.catalogItemId,
            })
            .from(catalogItemPerson),
        db()
            .select({
                personId: catalogItemIsbnPerson.personId,
                catalogItemId: catalogItemIsbn.catalogItemId,
            })
            .from(catalogItemIsbnPerson)
            .innerJoin(
                catalogItemIsbn,
                eq(catalogItemIsbn.isbn, catalogItemIsbnPerson.isbn)
            )
    ).as('credits');
}

// Matches the name or any other spelling.
function nameMatching(q: string) {
    const pattern = likePattern(q);
    return or(
        ilike(person.name, pattern),
        ilike(sql`array_to_string(${person.aliases}, ' ')`, pattern)
    );
}

async function requirePerson(id: string) {
    const found = await db().query.person.findFirst({
        where: eq(person.id, id),
    });
    if (!found) {
        throw new HTTPException(404, { message: 'Person not found' });
    }
    return found;
}

// Authors and illustrators: picking who made a book, and fixing names.
const adminPeople = new Hono<AppEnv>()
    .get('/', schemaValidator('query', NameListQuerySchema), async (c) => {
        const { q, ...page } = c.req.valid('query');
        const where = q ? nameMatching(q) : undefined;
        const credited = credits();
        const uses = db()
            .select({
                personId: credited.personId,
                count: sql<number>`count(distinct ${credited.catalogItemId})::int`.as(
                    'count'
                ),
            })
            .from(credited)
            .groupBy(credited.personId)
            .as('uses');
        return c.json(
            await paginateWithTotal(
                page,
                (limit, offset) =>
                    db()
                        .select({
                            id: person.id,
                            name: person.name,
                            aliases: person.aliases,
                            uses: sql<number>`coalesce(${uses.count}, 0)::int`,
                        })
                        .from(person)
                        .leftJoin(uses, eq(uses.personId, person.id))
                        .where(where)
                        .orderBy(asc(person.name), asc(person.id))
                        .limit(limit)
                        .offset(offset),
                () => db().$count(person, where)
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
                        .select({ id: person.id, name: person.name })
                        .from(person)
                        .where(nameMatching(q))
                        .orderBy(
                            desc(sql`lower(${person.name}) = lower(${q})`),
                            asc(person.name)
                        )
                        .limit(limit)
                        .offset(offset)
                )
            );
        }
    )
    .get('/:id', schemaValidator('param', IdParamSchema), async (c) => {
        const found = await requirePerson(c.req.valid('param').id);
        const [workCredits, editionCredits] = await Promise.all([
            db()
                .select({
                    id: catalogItem.id,
                    title: catalogItem.title,
                    role: catalogItemPerson.role,
                })
                .from(catalogItemPerson)
                .innerJoin(
                    catalogItem,
                    eq(catalogItem.id, catalogItemPerson.catalogItemId)
                )
                .where(eq(catalogItemPerson.personId, found.id)),
            // One row per book and role, with the editions that credit them.
            db()
                .select({
                    id: catalogItem.id,
                    title: catalogItem.title,
                    role: catalogItemIsbnPerson.role,
                    isbns: sql<string>`string_agg(${catalogItemIsbn.isbn}, ', ' order by ${catalogItemIsbn.isbn})`,
                })
                .from(catalogItemIsbnPerson)
                .innerJoin(
                    catalogItemIsbn,
                    eq(catalogItemIsbn.isbn, catalogItemIsbnPerson.isbn)
                )
                .innerJoin(
                    catalogItem,
                    eq(catalogItem.id, catalogItemIsbn.catalogItemId)
                )
                .where(eq(catalogItemIsbnPerson.personId, found.id))
                .groupBy(catalogItem.id, catalogItemIsbnPerson.role),
        ]);
        const uses = [
            ...workCredits.map(({ id, title, role }) => ({
                id,
                title,
                detail: PERSON_ROLE_LABELS[role],
            })),
            ...editionCredits.map(({ id, title, role, isbns }) => ({
                id,
                title,
                detail: `${PERSON_ROLE_LABELS[role]} · ${isbns}`,
            })),
        ].sort((a, b) => a.title.localeCompare(b.title));
        return c.json({
            id: found.id,
            name: found.name,
            aliases: found.aliases,
            uses,
        });
    })
    .put(
        '/:id',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', UpdateNameSchema),
        async (c) => {
            const found = await requirePerson(c.req.valid('param').id);
            const { name, aliases } = c.req.valid('json');
            await db()
                .update(person)
                .set({ ...namedValues(name, aliases), updatedAt: new Date() })
                .where(eq(person.id, found.id));
            return c.body(null, 204);
        }
    )
    // Moves every credit to the other person, who also takes this person's
    // spellings, then deletes this one.
    .post(
        '/:id/merge',
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', MergeNameSchema),
        async (c) => {
            const from = await requirePerson(c.req.valid('param').id);
            const into = await requirePerson(c.req.valid('json').intoId);
            if (from.id === into.id) {
                throw new HTTPException(400, {
                    message: "Can't merge a person into themselves",
                });
            }
            await db().transaction(async (tx) => {
                // A book or edition crediting both in the same role keeps one
                // credit.
                await tx.execute(sql`
                    delete from ${catalogItemPerson} a
                    using ${catalogItemPerson} b
                    where a.person_id = ${from.id}
                        and b.person_id = ${into.id}
                        and a.catalog_item_id = b.catalog_item_id
                        and a.role = b.role
                `);
                await tx
                    .update(catalogItemPerson)
                    .set({ personId: into.id })
                    .where(eq(catalogItemPerson.personId, from.id));
                await tx.execute(sql`
                    delete from ${catalogItemIsbnPerson} a
                    using ${catalogItemIsbnPerson} b
                    where a.person_id = ${from.id}
                        and b.person_id = ${into.id}
                        and a.isbn = b.isbn
                        and a.role = b.role
                `);
                await tx
                    .update(catalogItemIsbnPerson)
                    .set({ personId: into.id })
                    .where(eq(catalogItemIsbnPerson.personId, from.id));
                await tx
                    .update(person)
                    .set({ ...mergedValues(into, from), updatedAt: new Date() })
                    .where(eq(person.id, into.id));
                await tx.delete(person).where(eq(person.id, from.id));
            });
            return c.body(null, 204);
        }
    );

export default adminPeople;
