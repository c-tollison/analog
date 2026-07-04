import { createDb, type Database } from '@analog/db';
import type { Logger } from '@analog/server';
import { Stage } from '@analog/types';

import type { Config } from './config.js';

export function createDbClient(config: Config, logger: Logger): Database {
    const { host, port, user, password, name, maxConnections } = config.db;
    const ssl =
        config.stage === Stage.Local ? false : { rejectUnauthorized: true };

    logger.info(
        {
            db: {
                host,
                port,
                database: name,
                maxConnections,
                sslEnabled: Boolean(ssl),
            },
        },
        'Creating database client'
    );

    return createDb({
        host,
        port,
        user,
        password,
        database: name,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        max: maxConnections,
        ssl,
    });
}
