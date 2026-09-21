import type { Database } from '@analog/db';

import { type Auth, CreateAuthInstance } from './auth.js';
import type { Config } from './config.js';
import { createDbClient } from './db.js';
import { createLogger, type Logger } from './logger.js';

export interface Container {
    logger: Logger;
    config: Config;
    db: Database;
    auth: Auth;
}

export async function createContainer(cfg: Config): Promise<Container> {
    const logger = createLogger(cfg.stage);
    const db = createDbClient(cfg, logger);
    const auth = CreateAuthInstance(cfg, logger, db);

    return {
        logger,
        config: cfg,
        db,
        auth,
    };
}

let _container: Container | undefined;

export function setContainer(container: Container): void {
    _container = container;
}

function assertInit<T>(value: T | undefined, name: string): T {
    if (!value) {
        throw new Error(
            `Container not initialized: '${name}'. Call init() first.`
        );
    }
    return value;
}

export const logger = (): Logger => assertInit(_container, 'logger').logger;
export const config = (): Config => assertInit(_container, 'config').config;
export const db = (): Database => assertInit(_container, 'db').db;
export const auth = (): Auth => assertInit(_container, 'auth').auth;

export async function init(cfg: Config): Promise<void> {
    setContainer(await createContainer(cfg));
}
