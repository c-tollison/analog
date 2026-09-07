import type { Config } from './config.js';
import type { cors } from 'hono/cors';

type CorsOptions = NonNullable<Parameters<typeof cors>[0]>;

export function getCorsConfig(config: Config['cors']): CorsOptions {
    return {
        origin: config.origins,
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        maxAge: 86400,
        credentials: true,
    };
}
