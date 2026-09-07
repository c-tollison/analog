import type { Logger } from '../lib/logger.js';
import { createMiddleware } from 'hono/factory';

export function createRequestLoggerMiddleware(logger: Logger) {
    return createMiddleware(async (c, next) => {
        const start = Date.now();
        const requestId = c.get('requestId');
        const { method, path } = c.req;

        logger.info({ requestId, method, path }, 'Request started');

        await next();

        logger.info(
            {
                requestId,
                method,
                path,
                status: c.res.status,
                duration: Date.now() - start,
            },
            'Request completed'
        );
    });
}
