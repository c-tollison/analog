import { createDb } from '../index.js';
import { runSeed } from './seed-data.js';

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is not set');
    }

    const db = createDb({ connectionString });
    try {
        await runSeed(db);
        console.log('Seed applied');
    } finally {
        await db.$client.end();
    }
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
