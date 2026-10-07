import { and, eq, inArray, isNotNull, isNull, schema } from '@analog/db';
import { CheckRule, type CheckTrigger } from '@analog/types';

import { withPeople } from './book-values.js';
import {
    type Checked,
    checkDuplicateVolumes,
    checkItem,
    checkSeries,
    type Problem,
} from './catalog-check.js';
import { config, db, logger } from './init.js';
import { TypeSafeClient } from '@typesafe-ai/sdk';

// Runs the Jev checks on one book or series, saves what they find for the
// admin pages, and logs each run with its token cost for the admin history.
// Saving a book starts a check in the background; `pnpm catalog:check`
// runs them all.

const { catalogCheck, catalogCheckRun, catalogItem, series } = schema;

let cachedClient: TypeSafeClient | undefined;

export function checkClient(): TypeSafeClient {
    cachedClient ??= new TypeSafeClient({ apiKey: config().typesafe.apiKey });
    return cachedClient;
}

type Target = { catalogItemId: string } | { seriesId: string };

function targetWhere(target: Target) {
    return 'catalogItemId' in target
        ? eq(catalogCheck.catalogItemId, target.catalogItemId)
        : eq(catalogCheck.seriesId, target.seriesId);
}

// The same problem on the same book or series, across runs.
function problemKey(problem: Problem): string {
    const target = problem.catalogItemId ?? problem.seriesId;
    return `${target}:${problem.rule}:${problem.message}`;
}

/**
 * Replaces a book's or series' open problems with new ones, leaving out any
 * an admin dismissed before. Returns the ones saved.
 */
async function saveProblems(
    target: Target,
    found: Problem[]
): Promise<Problem[]> {
    const dismissed = await db()
        .select()
        .from(catalogCheck)
        .where(and(targetWhere(target), isNotNull(catalogCheck.dismissedAt)));
    const dismissedKeys = new Set(dismissed.map(problemKey));
    const problems = found.filter(
        (problem) => !dismissedKeys.has(problemKey(problem))
    );
    await db().transaction(async (tx) => {
        await tx
            .delete(catalogCheck)
            .where(and(targetWhere(target), isNull(catalogCheck.dismissedAt)));
        if (problems.length) {
            await tx.insert(catalogCheck).values(problems);
        }
    });
    return problems;
}

/** Runs a check, then saves and logs it. A failed run is logged too. */
async function runAndLog(
    run: { trigger: CheckTrigger; title: string } & Partial<Target>,
    target: Target,
    check: () => Promise<Checked>
): Promise<Problem[]> {
    const started = Date.now();
    try {
        const { problems, usage } = await check();
        const saved = await saveProblems(target, problems);
        await db()
            .insert(catalogCheckRun)
            .values({
                ...run,
                ...usage,
                problems: saved.length,
                durationMs: Date.now() - started,
            });
        return saved;
    } catch (error) {
        await db()
            .insert(catalogCheckRun)
            .values({
                ...run,
                durationMs: Date.now() - started,
                error: error instanceof Error ? error.message : String(error),
            });
        throw error;
    }
}

/**
 * Suggested names for these series from their open "Series name" problems,
 * so their books' title fixes use them.
 */
async function suggestedNames(seriesIds: string[]) {
    const rows = seriesIds.length
        ? await db()
              .select({
                  seriesId: catalogCheck.seriesId,
                  fix: catalogCheck.fix,
              })
              .from(catalogCheck)
              .where(
                  and(
                      inArray(catalogCheck.seriesId, seriesIds),
                      eq(catalogCheck.rule, CheckRule.SeriesSpelling),
                      isNull(catalogCheck.dismissedAt)
                  )
              )
        : [];
    return new Map(
        rows.flatMap(({ seriesId, fix }) =>
            seriesId && fix ? [[seriesId, fix] as const] : []
        )
    );
}

/** Checks one unverified book. Returns what it found. */
export async function recheckItem(
    client: TypeSafeClient,
    itemId: string,
    trigger: CheckTrigger
): Promise<Problem[]> {
    const item = await db().query.catalogItem.findFirst({
        where: eq(catalogItem.id, itemId),
        with: {
            isbns: { with: { publisher: { columns: { name: true } } } },
            series: true,
            ...withPeople,
        },
    });
    if (!item || item.verifiedAt) {
        return [];
    }
    const { seriesId } = item;
    return runAndLog(
        { trigger, title: item.title, catalogItemId: item.id },
        { catalogItemId: item.id },
        async () => {
            const names = await suggestedNames(seriesId ? [seriesId] : []);
            const checked = await checkItem(client, item, names);
            const duplicates = seriesId
                ? await checkDuplicateVolumes(new Set([item.id]), seriesId)
                : [];
            return {
                problems: [...checked.problems, ...duplicates],
                usage: checked.usage,
            };
        }
    );
}

/** Checks one unverified series. Returns what it found. */
export async function recheckSeries(
    client: TypeSafeClient,
    seriesId: string,
    trigger: CheckTrigger
): Promise<Problem[]> {
    const row = await db().query.series.findFirst({
        where: eq(series.id, seriesId),
    });
    if (!row || row.verifiedAt) {
        return [];
    }
    return runAndLog(
        { trigger, title: row.title, seriesId: row.id },
        { seriesId: row.id },
        () => checkSeries(client, row)
    );
}

// Checks still running in the background, so a script can wait for them.
const running = new Set<Promise<void>>();

/**
 * Checks a saved book, and its series first when that's unverified, without
 * making the caller wait. Failures are logged, never thrown.
 */
export function checkInBackground(itemId: string, trigger: CheckTrigger) {
    const typesafe = checkClient();
    const task = (async () => {
        try {
            const item = await db().query.catalogItem.findFirst({
                where: eq(catalogItem.id, itemId),
                columns: { seriesId: true },
            });
            // The series goes first, so the book's title fix can use its
            // suggested name.
            if (item?.seriesId) {
                await recheckSeries(typesafe, item.seriesId, trigger);
            }
            await recheckItem(typesafe, itemId, trigger);
        } catch (error) {
            logger().warn({ error, itemId }, 'Background check failed');
        }
    })();
    running.add(task);
    void task.finally(() => running.delete(task));
}

/** Waits for background checks to finish, before a script closes the db. */
export async function settleChecks(): Promise<void> {
    await Promise.all(running);
}
