import type { Database } from '@analog/db';
import { Stage } from '@analog/types';

import type { Config } from './config.js';
import type { Logger } from './logger.js';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

export type Auth = ReturnType<typeof CreateAuthInstance>;

export function CreateAuthInstance(
    config: Config,
    logger: Logger,
    db: Database
) {
    const auth = betterAuth({
        database: drizzleAdapter(db, {
            provider: 'pg',
        }),
        secret: config.auth.secret,
        baseURL: config.appUrl,
        trustedOrigins: config.cors.origins,
        advanced: {
            database: { generateId: 'uuid' },
        },
        logger: {
            level: config.stage === Stage.Local ? 'debug' : 'warn',
            log: (level, message, ...args) => logger[level]({ args }, message),
        },
        emailAndPassword: {
            enabled: true,
        },
    });

    logger.info(
        { baseUrl: config.appUrl, trustedOrigins: config.cors.origins },
        'auth initialized'
    );

    return auth;
}
