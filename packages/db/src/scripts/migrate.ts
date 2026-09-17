import { resolve } from 'node:path';

import { createDb } from '../index.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const MIGRATIONS_FOLDER = resolve(import.meta.dirname, '../../drizzle');

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is not set');
    }

    const db = createDb({ connectionString, max: 1 });
    try {
        await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
        console.log('Migrations applied');
    } finally {
        await db.$client.end();
    }
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
