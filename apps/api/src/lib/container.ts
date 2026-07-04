import type { Database } from '@analog/db';
import { createLogger, type Logger } from '@analog/server';

import type { Config } from './config.js';
import { createDbClient } from './db.js';

let _logger: Logger | undefined;
let _config: Config | undefined;
let _db: Database | undefined;

function assertInit<T>(value: T | undefined, name: string): T {
    if (!value)
        throw new Error(
            `Container not initialized: '${name}'. Call init() first.`
        );
    return value;
}

export const logger = (): Logger => assertInit(_logger, 'logger');
export const config = (): Config => assertInit(_config, 'config');
export const db = (): Database => assertInit(_db, 'db');

/** Must be called once at startup before anything else uses this module. */
export function init(cfg: Config): void {
    const log = createLogger(cfg.stage);
    _logger = log;
    _config = cfg;
    _db = createDbClient(cfg, log);
}
