import type { Config } from './lib/config.js';
import { getCorsConfig } from './lib/cors.js';
import { auth, logger } from './lib/init.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { createRequestLoggerMiddleware } from './middleware/request-logger.js';
import { requireAuth } from './middleware/require-auth.js';
import admin from './routes/admin.js';
import catalog from './routes/catalog.js';
import collections from './routes/collections.js';
import friends from './routes/friends.js';
import genres from './routes/genres.js';
import invites from './routes/invites.js';
import items from './routes/items.js';
import notifications from './routes/notifications.js';
import series from './routes/series.js';
import users from './routes/users.js';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';

const MAX_BODY_BYTES = 1024 * 1024;
// Cover uploads can be photos straight off a phone.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const COVER_UPLOAD_PATH = /^\/api\/admin\/items\/[^/]+\/isbns\/[^/]+\/cover$/;

export function createApp(config: Config) {
    const app = new Hono();

    app.get('/api/health', (c) => c.json({ status: 'ok' }));

    app.use('*', cors(getCorsConfig(config.cors)));
    const limitBody = bodyLimit({ maxSize: MAX_BODY_BYTES });
    const limitUpload = bodyLimit({
        maxSize: MAX_UPLOAD_BYTES,
        onError: () => {
            throw new HTTPException(413, {
                message: 'That image is too big. The limit is 10 MB.',
            });
        },
    });
    app.use('*', (c, next) =>
        COVER_UPLOAD_PATH.test(c.req.path)
            ? limitUpload(c, next)
            : limitBody(c, next)
    );
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
        .route('/catalog', catalog)
        .route('/items', items)
        .route('/collections', collections)
        .route('/series', series)
        .route('/genres', genres)
        .route('/friends', friends)
        .route('/users', users)
        .route('/invites', invites)
        .route('/notifications', notifications)
        .route('/admin', admin);
}

export type ApiRoutes = ReturnType<typeof createApp>;
