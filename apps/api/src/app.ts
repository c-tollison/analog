import type { Config } from './lib/config.js';
import { getCorsConfig } from './lib/cors.js';
import helloWorld from './routes/helloworld.js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';

export function createApp(config: Config) {
    const app = new Hono();

    app.get('/api/health', (c) => c.json({ status: 'ok' }));

    app.use('*', cors(getCorsConfig(config.cors)));
    app.use('*', secureHeaders());
    app.use('*', requestId());

    const api = app.basePath('/api');

    return api.route('/hello-world', helloWorld);
}

export type ApiRoutes = ReturnType<typeof createApp>;
