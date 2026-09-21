import type { Database } from '@analog/db';
import {
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    SignUpSchema,
    Stage,
} from '@analog/types';

import type { Config } from './config.js';
import type { Logger } from './logger.js';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';

const SESSION_EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days
const SESSION_UPDATE_AGE = 60 * 60 * 24; // extend expiry at most once a day
const SESSION_COOKIE_CACHE_MAX_AGE = 60 * 5; // 5 minutes

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
        session: {
            expiresIn: SESSION_EXPIRES_IN,
            updateAge: SESSION_UPDATE_AGE,
            cookieCache: {
                enabled: true,
                maxAge: SESSION_COOKIE_CACHE_MAX_AGE,
            },
        },
        emailAndPassword: {
            enabled: true,
            minPasswordLength: PASSWORD_MIN_LENGTH,
            maxPasswordLength: PASSWORD_MAX_LENGTH,
        },
        hooks: {
            before: createAuthMiddleware(async (ctx) => {
                if (ctx.path !== '/sign-up/email') {
                    return;
                }

                const result = SignUpSchema.safeParse(ctx.body);
                if (!result.success) {
                    throw new APIError('BAD_REQUEST', {
                        message:
                            result.error.issues[0]?.message ??
                            'Invalid sign-up details',
                    });
                }
            }),
        },
    });

    logger.info(
        { baseUrl: config.appUrl, trustedOrigins: config.cors.origins },
        'auth initialized'
    );

    return auth;
}
