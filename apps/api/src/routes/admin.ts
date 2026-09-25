import type { AppEnv } from '../lib/app-env.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { Hono } from 'hono';

const admin = new Hono<AppEnv>()
    .use(requireAdmin)
    .get('/', (c) => c.json({ status: 'ok' }));

export default admin;
