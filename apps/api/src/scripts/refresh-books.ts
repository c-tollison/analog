import { and, asc, eq, isNotNull, isNull, or, schema } from '@analog/db';
import { MediaFormat } from '@analog/types';

import { refreshBook } from '../lib/books.js';
import { loadConfig } from '../lib/config.js';
import { db, init, logger } from '../lib/init.js';
import { HTTPException } from 'hono/http-exception';

// Looks up books with an ISBN again, the same as the refresh endpoint, until
// both Google Books and Open Library have answered for each. Series and
// volumes aren't touched. Pass --all to look up every book, and --dry-run to
// list the books without changing them.

// Open Library allows 3 requests a second, and one lookup makes up to 4.
// Google allows 100 a minute, and one lookup makes 1.
const PAUSE_MS = 1_500;
// When a source is busy, wait this long and try the same book again. Stop
// after this many tries, since the daily quota is likely used up.
const BUSY_PAUSE_MS = 60_000;
const BUSY_TRIES = 3;

const { catalogItem } = schema;

async function main() {
    await init(loadConfig());
    const dryRun = process.argv.includes('--dry-run');
    const all = process.argv.includes('--all');

    const books = await db()
        .select({ id: catalogItem.id, title: catalogItem.title })
        .from(catalogItem)
        .where(
            and(
                eq(catalogItem.format, MediaFormat.Book),
                isNotNull(catalogItem.barcode),
                all
                    ? undefined
                    : or(
                          isNull(catalogItem.googleBooksFetchedAt),
                          isNull(catalogItem.openLibraryFetchedAt)
                      )
            )
        )
        .orderBy(asc(catalogItem.title));
    logger().info({ count: books.length, all, dryRun }, 'Books to refresh');

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
            const updated = await refreshBook(book.id, !all);
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
