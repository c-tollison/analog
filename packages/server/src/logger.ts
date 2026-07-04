import { Stage } from '@analog/types';
import pino from 'pino';

export function createLogger(stage: Stage) {
    const isDev = stage === Stage.Local;

    return pino({
        level: isDev ? 'debug' : 'info',
        ...(isDev && {
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                },
            },
        }),
    });
}

export type Logger = ReturnType<typeof createLogger>;
