import { and, asc, eq, isNotNull, schema } from '@analog/db';
import { MediaFormat } from '@analog/types';

import { refreshBook } from '../lib/books.js';
import { loadConfig } from '../lib/config.js';
import { db, init, logger } from '../lib/init.js';

// Looks up every book with an ISBN again, the same as the item page's Refresh
// details button. Series and volumes aren't touched. Pass --dry-run to list
// the books without changing them.

// Open Library allows 3 requests a second, and one lookup makes up to 4.
const PAUSE_MS = 1_500;

const { catalogItem } = schema;

async function main() {
    await init(loadConfig());
    const dryRun = process.argv.includes('--dry-run');

    const books = await db()
        .select({ id: catalogItem.id, title: catalogItem.title })
        .from(catalogItem)
        .where(
            and(
                eq(catalogItem.format, MediaFormat.Book),
                isNotNull(catalogItem.barcode)
            )
        )
        .orderBy(asc(catalogItem.title));
    logger().info({ count: books.length, dryRun }, 'Books to refresh');

    let failed = 0;
    for (const book of books) {
        if (dryRun) {
            logger().info({ title: book.title }, 'Would refresh');
            continue;
        }
        try {
            const updated = await refreshBook(book.id);
            logger().info(
                { title: updated?.title, hasCover: !!updated?.coverUrl },
                'Refreshed'
            );
        } catch (error) {
            failed++;
            logger().warn({ error, title: book.title }, 'Refresh failed');
        }
        await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
    logger().info({ count: books.length, failed }, 'Done');
    await db().$client.end();
}

main().catch((err) => {
    // biome-ignore lint/suspicious/noConsole: The logger may not have started
    console.error(err);
    process.exitCode = 1;
});
