import { AdminGoogleSearchQuerySchema, UserRole } from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { searchGoogleBooks } from '../lib/google-books.js';
import { schemaValidator } from '../lib/validator.js';
import { requireRole } from '../middleware/require-role.js';
import adminChecks from './admin-checks.js';
import adminItems from './admin-items.js';
import adminPeople from './admin-people.js';
import adminPublishers from './admin-publishers.js';
import adminSeries from './admin-series.js';
import { Hono } from 'hono';

// Admins only: changes to data every user shares, and adding to it.
const admin = new Hono<AppEnv>()
    .use(requireRole(UserRole.Admin))
    .route('/items', adminItems)
    .route('/series', adminSeries)
    .route('/people', adminPeople)
    .route('/publishers', adminPublishers)
    .route('/checks', adminChecks)
    .get(
        '/google',
        schemaValidator('query', AdminGoogleSearchQuerySchema),
        async (c) => {
            const { q, lang, offset } = c.req.valid('query');
            return c.json(await searchGoogleBooks(q, { offset, lang }));
        }
    );

export default admin;
