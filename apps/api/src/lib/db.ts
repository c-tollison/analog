import { createDb, type Database } from '@analog/db';

import type { Config } from './config.js';
import type { Logger } from './logger.js';

export function createDbClient(config: Config, logger: Logger): Database {
    const { url, maxConnections, ssl } = config.db;

    const parsed = new URL(url);
    logger.info(
        {
            db: {
                host: parsed.hostname,
                port: parsed.port,
                database: parsed.pathname.slice(1),
                user: parsed.username,
                maxConnections,
                ssl,
            },
        },
        'Creating database client'
    );

    return createDb({
        connectionString: url,
        max: maxConnections,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        ssl: ssl ? { rejectUnauthorized: true } : false,
    });
}
