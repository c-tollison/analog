import { and, asc, eq, inArray, isNull, or, schema } from '@analog/db';
import { CheckTrigger } from '@analog/types';

import { refreshBook } from '../lib/books.js';
import { checkInBackground, settleChecks } from '../lib/check-runs.js';
import { loadConfig } from '../lib/config.js';
import { db, init, logger } from '../lib/init.js';
import { HTTPException } from 'hono/http-exception';

// Looks up unverified books with an ISBN that Google Books or Open Library
// hasn't answered for yet, and asks only the missing source. Series and
// volumes aren't touched. Pass --dry-run to list the books without changing
// them.

// Open Library allows 3 requests a second, and one lookup makes up to 4.
// Google allows 100 a minute, and one lookup makes 1.
const PAUSE_MS = 1_500;
// When a source is busy, wait this long and try the same book again. Stop
// after this many tries, since the daily quota is likely used up.
const BUSY_PAUSE_MS = 60_000;
const BUSY_TRIES = 3;

const { catalogItem, catalogItemIsbn } = schema;

async function main() {
    await init(loadConfig());
    const dryRun = process.argv.includes('--dry-run');

    const books = await db()
        .select({ id: catalogItem.id, title: catalogItem.title })
        .from(catalogItem)
        .where(
            and(
                // Only books with a main ISBN can be looked up again.
                inArray(
                    catalogItem.id,
                    db()
                        .select({ id: catalogItemIsbn.catalogItemId })
                        .from(catalogItemIsbn)
                        .where(eq(catalogItemIsbn.main, true))
                ),
                isNull(catalogItem.verifiedAt),
                or(
                    isNull(catalogItem.googleBooksFetchedAt),
                    isNull(catalogItem.openLibraryFetchedAt)
                )
            )
        )
        .orderBy(asc(catalogItem.title));
    logger().info({ count: books.length, dryRun }, 'Books to refresh');

    let failed = 0;
    let busyTries = 0;
    for (let i = 0; i < books.length; i++) {
        const book = books[i];
        if (!book) {
            continue;
        }
        if (dryRun) {
            logger().info({ title: book.title }, 'Would refresh');
            continue;
        }
        try {
            const updated = await refreshBook(book.id, true);
            checkInBackground(book.id, CheckTrigger.Refresh);
            busyTries = 0;
            logger().info(
                { title: updated?.title, hasCover: !!updated?.coverUrl },
                'Refreshed'
            );
        } catch (error) {
            if (error instanceof HTTPException && error.status === 503) {
                busyTries++;
                if (busyTries >= BUSY_TRIES) {
                    logger().warn(
                        { title: book.title, refreshed: i - failed },
                        'Still busy, stopping. Rerun later.'
                    );
                    break;
                }
                logger().warn({ title: book.title }, 'Busy, waiting');
                await sleep(BUSY_PAUSE_MS);
                i--;
                continue;
            }
            busyTries = 0;
            failed++;
            logger().warn({ error, title: book.title }, 'Refresh failed');
        }
        await sleep(PAUSE_MS);
    }
    logger().info({ count: books.length, failed }, 'Done');
    await settleChecks();
    await db().$client.end();
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
    // biome-ignore lint/suspicious/noConsole: The logger may not have started
    console.error(err);
    process.exitCode = 1;
});
