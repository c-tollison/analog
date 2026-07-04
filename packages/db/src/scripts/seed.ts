import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { runSeed } from './seed-data.js';
import * as schema from '../schema/index.js';

async function main() {
    const connectionString =
        process.env.DATABASE_URL ?? process.env.DATABASE_URL_ADMIN;
    if (!connectionString) {
        throw new Error(
            'Missing DATABASE_URL (or DATABASE_URL_ADMIN). Set it in your shell, or run via the package script (which uses Node --env-file).'
        );
    }

    const pool = new Pool({ connectionString });
    const db = drizzle(pool, { schema });

    try {
        await runSeed({ db });
        console.log('[✓] Seed data applied successfully!');
    } finally {
        await pool.end();
    }
}

main().catch((err) => {
    if (err instanceof Error) {
        console.error(err.stack ?? err.message);
        const cause = (err as { cause?: unknown }).cause;
        if (cause != null) console.error(cause);
    } else {
        console.error(err);
    }
    process.exitCode = 1;
});
