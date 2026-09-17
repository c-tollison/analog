import type { Logger } from '../lib/logger.js';
import { sanitizePath } from '../lib/sanitize-path.js';
import { createMiddleware } from 'hono/factory';

export function createRequestLoggerMiddleware(logger: Logger) {
    return createMiddleware(async (c, next) => {
        const start = Date.now();
        const requestId = c.get('requestId');
        const method = c.req.method;
        const path = sanitizePath(c.req.path);

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
