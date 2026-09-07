import type { Config } from './config.js';
import { createLogger, type Logger } from './logger.js';

export interface Container {
    logger: Logger;
    config: Config;
}

export async function createContainer(cfg: Config): Promise<Container> {
    const logger = createLogger(cfg.stage);

    return {
        logger,
        config: cfg,
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

export async function init(cfg: Config): Promise<void> {
    setContainer(await createContainer(cfg));
}
