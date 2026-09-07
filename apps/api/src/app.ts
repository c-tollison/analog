import type { Config } from './lib/config.js';
import { getCorsConfig } from './lib/cors.js';
import { logger } from './lib/init.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { createRequestLoggerMiddleware } from './middleware/request-logger.js';
import helloWorld from './routes/helloworld.js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';

export function createApp(config: Config) {
    const app = new Hono();

    app.get('/api/health', (c) => c.json({ status: 'ok' }));

    app.use('*', cors(getCorsConfig(config.cors)));
    app.use('*', secureHeaders());
    app.use('*', requestId());
    app.use('*', createRequestLoggerMiddleware(logger()));

    app.notFound(() => {
        throw new HTTPException(404, { message: 'Route not found' });
    });
    app.onError(createErrorHandler(logger()));

    const api = app.basePath('/api');

    return api.route('/hello-world', helloWorld);
}

export type ApiRoutes = ReturnType<typeof createApp>;
