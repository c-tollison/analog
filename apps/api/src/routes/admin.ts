import { UserRole } from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { requireRole } from '../middleware/require-role.js';
import adminItems from './admin-items.js';
import adminSeries from './admin-series.js';
import { Hono } from 'hono';

// Changes to data every user shares. Admins only.
const admin = new Hono<AppEnv>()
    .use(requireRole(UserRole.Admin))
    .route('/items', adminItems)
    .route('/series', adminSeries);

export default admin;
