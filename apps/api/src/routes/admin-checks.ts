import { and, asc, eq, isNull, or, schema, sql } from '@analog/db';
import {
    ACCEPTABLE_RULES,
    CheckRule,
    CheckRunListQuerySchema,
} from '@analog/types';

import { byAdded, totalCount } from '../lib/admin.js';
import type { AppEnv } from '../lib/app-env.js';
import { kindInSeries, refreshSeriesCover } from '../lib/books.js';
import { db } from '../lib/init.js';
import { paginateWithTotal } from '../lib/pagination.js';
import { IdParamSchema } from '../lib/params.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

// The problems `pnpm catalog:check` found, shown on the admin item and
// series pages. An admin accepts a fix, which makes the change and clears
// the problem, or dismisses it so later runs don't flag it again.

const { catalogCheck, catalogCheckRun, catalogItem, series } = schema;

type Check = typeof catalogCheck.$inferSelect;

const isOpen = isNull(catalogCheck.dismissedAt);

async function requireCheck(id: string): Promise<Check> {
    const found = await db().query.catalogCheck.findFirst({
        where: and(eq(catalogCheck.id, id), isOpen),
    });
    if (!found) {
        throw new HTTPException(404, { message: 'Suggestion not found' });
    }
    return found;
}

async function requireItem(id: string | null) {
    const found = id
        ? await db().query.catalogItem.findFirst({
              where: eq(catalogItem.id, id),
          })
        : undefined;
    if (!found) {
        throw new HTTPException(404, { message: 'Book not found' });
    }
    return found;
}

async function requireSeries(id: string | null) {
    const found = id
        ? await db().query.series.findFirst({ where: eq(series.id, id) })
        : undefined;
    if (!found) {
        throw new HTTPException(404, { message: 'Series not found' });
    }
    return found;
}

/** Makes the change a check suggests, then clears the check. */
async function acceptCheck(check: Check): Promise<void> {
    const { fix } = check;
    if (!fix || !ACCEPTABLE_RULES.includes(check.rule)) {
        throw new HTTPException(400, {
            message: "This suggestion can't be accepted in one click",
        });
    }
    const updatedAt = new Date();

    if (check.rule === CheckRule.SeriesSpelling) {
        const found = await requireSeries(check.seriesId);
        await db()
            .update(series)
            .set({ title: fix, updatedAt })
            .where(eq(series.id, found.id));
    } else {
        const item = await requireItem(check.catalogItemId);
        if (check.rule === CheckRule.TitleStyle) {
            await db()
                .update(catalogItem)
                .set({ title: fix, updatedAt })
                .where(eq(catalogItem.id, item.id));
        }
        if (check.rule === CheckRule.VolumeMismatch) {
            const volume = Number(fix);
            if (!Number.isFinite(volume)) {
                throw new HTTPException(400, { message: 'Bad volume number' });
            }
            await db()
                .update(catalogItem)
                .set({ position: volume, updatedAt })
                .where(eq(catalogItem.id, item.id));
        }
        if (check.rule === CheckRule.WrongSeries) {
            const next = await requireSeries(fix);
            await db()
                .update(catalogItem)
                .set({
                    seriesId: next.id,
                    kind: kindInSeries(next, item.kind),
                    updatedAt,
                })
                .where(eq(catalogItem.id, item.id));
            await refreshSeriesCover(next.id);
            if (item.seriesId) {
                await refreshSeriesCover(item.seriesId);
            }
        }
    }

    await db().delete(catalogCheck).where(eq(catalogCheck.id, check.id));
}

// What the pages show about a problem.
const checkColumns = {
    id: catalogCheck.id,
    rule: catalogCheck.rule,
    message: catalogCheck.message,
    fix: catalogCheck.fix,
    confidence: catalogCheck.confidence,
    catalogItemId: catalogCheck.catalogItemId,
    seriesId: catalogCheck.seriesId,
};

// Totals for the check history, over the last week and all time.
const RECENT = sql`${catalogCheckRun.createdAt} > now() - interval '7 days'`;
const TOKENS = sql`${catalogCheckRun.inputTokens} + ${catalogCheckRun.outputTokens}`;

const adminChecks = new Hono<AppEnv>()
    // Every check run, newest first, for the dashboard's Checks tab.
    .get(
        '/runs',
        schemaValidator('query', CheckRunListQuerySchema),
        async (c) => {
            const { sort, ...page } = c.req.valid('query');
            const result = await paginateWithTotal(
                page,
                (limit, offset) =>
                    db()
                        .select({
                            id: catalogCheckRun.id,
                            trigger: catalogCheckRun.trigger,
                            title: catalogCheckRun.title,
                            catalogItemId: catalogCheckRun.catalogItemId,
                            seriesId: catalogCheckRun.seriesId,
                            requests: catalogCheckRun.requests,
                            inputTokens: catalogCheckRun.inputTokens,
                            outputTokens: catalogCheckRun.outputTokens,
                            problems: catalogCheckRun.problems,
                            durationMs: catalogCheckRun.durationMs,
                            error: catalogCheckRun.error,
                            createdAt: catalogCheckRun.createdAt,
                        })
                        .from(catalogCheckRun)
                        .orderBy(
                            byAdded(catalogCheckRun.createdAt, sort),
                            asc(catalogCheckRun.id)
                        )
                        .limit(limit)
                        .offset(offset),
                async () => {
                    const [row] = await db()
                        .select({ total: totalCount })
                        .from(catalogCheckRun);
                    return row?.total ?? 0;
                }
            );
            return c.json(result);
        }
    )
    .get('/usage', async (c) => {
        const [row] = await db()
            .select({
                runs: totalCount,
                tokens: sql<number>`coalesce(sum(${TOKENS}), 0)::int`,
                failed: sql<number>`count(${catalogCheckRun.error})::int`,
                weekRuns: sql<number>`count(*) filter (where ${RECENT})::int`,
                weekTokens: sql<number>`coalesce(sum(${TOKENS}) filter (where ${RECENT}), 0)::int`,
            })
            .from(catalogCheckRun);
        return c.json(row);
    })
    // An item's open problems, for its admin page.
    .get('/items/:id', schemaValidator('param', IdParamSchema), async (c) => {
        const rows = await db()
            .select(checkColumns)
            .from(catalogCheck)
            .where(
                and(
                    isOpen,
                    eq(catalogCheck.catalogItemId, c.req.valid('param').id)
                )
            )
            .orderBy(asc(catalogCheck.rule));
        return c.json(rows);
    })
    // A series' open problems and its items', for its admin page.
    .get('/series/:id', schemaValidator('param', IdParamSchema), async (c) => {
        const { id } = c.req.valid('param');
        const rows = await db()
            .select(checkColumns)
            .from(catalogCheck)
            .leftJoin(
                catalogItem,
                eq(catalogCheck.catalogItemId, catalogItem.id)
            )
            .where(
                and(
                    isOpen,
                    or(
                        eq(catalogCheck.seriesId, id),
                        eq(catalogItem.seriesId, id)
                    )
                )
            )
            .orderBy(asc(catalogCheck.rule));
        return c.json(rows);
    })
    .post('/:id/accept', schemaValidator('param', IdParamSchema), async (c) => {
        await acceptCheck(await requireCheck(c.req.valid('param').id));
        return c.body(null, 204);
    })
    .post(
        '/:id/dismiss',
        schemaValidator('param', IdParamSchema),
        async (c) => {
            const check = await requireCheck(c.req.valid('param').id);
            await db()
                .update(catalogCheck)
                .set({ dismissedAt: new Date() })
                .where(eq(catalogCheck.id, check.id));
            return c.body(null, 204);
        }
    );

export default adminChecks;
