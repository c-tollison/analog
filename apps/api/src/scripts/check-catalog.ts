import { asc, isNull, schema } from '@analog/db';
import { CHECK_RULES, CheckRule, CheckTrigger } from '@analog/types';

import type { Problem } from '../lib/catalog-check.js';
import { checkClient, recheckItem, recheckSeries } from '../lib/check-runs.js';
import { loadConfig } from '../lib/config.js';
import { db, init, logger } from '../lib/init.js';

// Checks every unverified series and book with the same checks that run
// when a book is saved (lib/check-runs.ts), and prints a count for each
// rule. Suggestions show on the admin book and series pages, and every run
// is logged in the dashboard's Checks tab. Needs TYPESAFE_API_KEY.
//
//   pnpm catalog:check [--limit=N]

// TypeSafe takes about 8 requests at once.
const AT_ONCE = 4;

const { catalogItem, series } = schema;

/** Runs `check` on every id, a few at a time. Failures are logged. */
async function checkAll(
    ids: string[],
    check: (id: string) => Promise<Problem[]>
) {
    const queue = [...ids];
    const problems: Problem[] = [];
    const worker = async () => {
        for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
            try {
                problems.push(...(await check(id)));
            } catch (error) {
                logger().warn({ error, id }, 'Check failed');
            }
        }
    };
    await Promise.all(Array.from({ length: AT_ONCE }, worker));
    return problems;
}

async function main() {
    await init(loadConfig());
    const client = checkClient();
    const arg = process.argv.find((value) => value.startsWith('--limit='));
    const limit = arg ? Number(arg.slice('--limit='.length)) : undefined;

    const seriesRows = await db().query.series.findMany({
        where: isNull(series.verifiedAt),
        columns: { id: true },
        orderBy: asc(series.title),
        limit,
    });
    const items = await db().query.catalogItem.findMany({
        where: isNull(catalogItem.verifiedAt),
        columns: { id: true },
        orderBy: asc(catalogItem.title),
        limit,
    });

    // Series first, so book title fixes can use their suggested names.
    const problems = [
        ...(await checkAll(
            seriesRows.map((row) => row.id),
            (id) => recheckSeries(client, id, CheckTrigger.Sweep)
        )),
        ...(await checkAll(
            items.map((item) => item.id),
            (id) => recheckItem(client, id, CheckTrigger.Sweep)
        )),
    ];

    const lines = [
        `Checked ${items.length} books and ${seriesRows.length} series. Found ${problems.length} problems.`,
    ];
    for (const rule of Object.values(CheckRule)) {
        const count = problems.filter(
            (problem) => problem.rule === rule
        ).length;
        if (count) {
            lines.push(`  ${CHECK_RULES[rule].label}: ${count}`);
        }
    }
    process.stdout.write(`${lines.join('\n')}\n`);
    await db().$client.end();
}

main().catch((err) => {
    // biome-ignore lint/suspicious/noConsole: The logger may not have started
    console.error(err);
    process.exitCode = 1;
});
