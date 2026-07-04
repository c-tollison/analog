import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';

import type { Logger } from '../logger.js';

export function createRequestLoggerMiddleware(
    logger: Logger
): MiddlewareHandler {
    return createMiddleware(async (c, next) => {
        const start = Date.now();
        const requestId = c.get('requestId');

        logger.info(
            {
                requestId,
                method: c.req.method,
                path: c.req.path,
            },
            'Request started'
        );

        await next();

        const duration = Date.now() - start;

        logger.info(
            {
                requestId,
                method: c.req.method,
                path: c.req.path,
                status: c.res.status,
                duration,
            },
            'Request completed'
        );
    });
}
