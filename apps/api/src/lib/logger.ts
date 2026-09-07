import { Stage } from '@analog/types';

import pino from 'pino';

export function createLogger(stage: Stage) {
    const isDev = stage === Stage.Local;

    return pino({
        level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
        base: { stage },
        ...(isDev && {
            transport: {
                target: 'pino-pretty',
                options: { colorize: true },
            },
        }),
    });
}

export type Logger = ReturnType<typeof createLogger>;
