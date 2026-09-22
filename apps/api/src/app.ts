import type { Config } from './lib/config.js';
import { getCorsConfig } from './lib/cors.js';
import { auth, logger } from './lib/init.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { createRequestLoggerMiddleware } from './middleware/request-logger.js';
import { requireAuth } from './middleware/require-auth.js';
import catalog from './routes/catalog.js';
import collections from './routes/collections.js';
import helloWorld from './routes/helloworld.js';
import series from './routes/series.js';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';

const MAX_BODY_BYTES = 1024 * 1024;

export function createApp(config: Config) {
    const app = new Hono();

    app.get('/api/health', (c) => c.json({ status: 'ok' }));

    app.use('*', cors(getCorsConfig(config.cors)));
    app.use('*', bodyLimit({ maxSize: MAX_BODY_BYTES }));
    app.use('*', secureHeaders());
    app.use('*', requestId());
    app.use('*', createRequestLoggerMiddleware(logger()));

    app.notFound(() => {
        throw new HTTPException(404, { message: 'Route not found' });
    });
    app.onError(createErrorHandler(logger()));

    const api = app.basePath('/api');
    api.on(['POST', 'GET'], '/auth/*', (c) => auth().handler(c.req.raw));
    return api
        .use(requireAuth)
        .route('/hello-world', helloWorld)
        .route('/catalog', catalog)
        .route('/collections', collections)
        .route('/series', series);
}

export type ApiRoutes = ReturnType<typeof createApp>;
