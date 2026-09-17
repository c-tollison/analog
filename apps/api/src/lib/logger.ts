import { Stage } from '@analog/types';

import pino from 'pino';

const REDACT_PATHS = [
    'authorization',
    '*.authorization',
    'cookie',
    '*.cookie',
    'password',
    '*.password',
    'secret',
    '*.secret',
    'token',
    '*.token',
    'accessToken',
    '*.accessToken',
    'refreshToken',
    '*.refreshToken',
];

export function createLogger(stage: Stage) {
    const isDev = stage === Stage.Local;

    return pino({
        level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
        base: { service: 'analog-api', stage },
        redact: REDACT_PATHS,
        ...(isDev && {
            transport: {
                target: 'pino-pretty',
                options: { colorize: true },
            },
        }),
    });
}

export type Logger = ReturnType<typeof createLogger>;
