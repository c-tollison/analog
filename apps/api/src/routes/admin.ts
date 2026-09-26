import { UserRole } from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { requireRole } from '../middleware/require-role.js';
import { Hono } from 'hono';

const admin = new Hono<AppEnv>()
    .use(requireRole(UserRole.Admin))
    .get('/', (c) => c.json({ status: 'ok' }));

export default admin;
