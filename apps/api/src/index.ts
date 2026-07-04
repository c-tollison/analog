import {
    createErrorHandler,
    createRequestLoggerMiddleware,
    registerGracefulShutdown,
} from '@analog/server';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';

import { type Config, loadConfig } from './lib/config.js';
import { db, init, logger } from './lib/container.js';
import { getCorsConfig } from './lib/cors.js';
import users from './routes/users.js';

export function createApp(config: Config) {
    const app = new Hono();

    app.use('*', cors(getCorsConfig(config.cors)));
    app.use('*', secureHeaders());
    app.use('*', requestId());
    app.use('*', createRequestLoggerMiddleware(logger()));

    app.notFound(() => {
        throw new HTTPException(404, { message: 'Route not found' });
    });

    app.onError(createErrorHandler(logger()));

    const api = app.basePath('/api');
    api.get('/health', (c) => c.json({ status: 'ok' }));

    return api.route('/users', users);
}

export type ApiRoutes = ReturnType<typeof createApp>;

function main() {
    const config = loadConfig();

    init(config);

    logger().info({ stage: config.stage }, 'Starting server');

    const app = createApp(config);

    const server = serve(
        {
            fetch: app.fetch,
            port: config.server.port,
        },
        (info) => {
            logger().info({ port: info.port }, 'Server is running');
        }
    );

    registerGracefulShutdown(server, logger(), () => db().$client.end());
}

main();
