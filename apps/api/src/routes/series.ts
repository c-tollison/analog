import {
    DetailsSourceSchema,
    LinkDetailsSourceSchema,
    SeriesSearchQuerySchema,
    SetVolumeCountSchema,
    UserRole,
} from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { discoverableSeries } from '../lib/discovery.js';
import { IdParamSchema } from '../lib/params.js';
import { searchSeries } from '../lib/search.js';
import {
    linkDetailsSource,
    searchDetailsSource,
    setVolumeCount,
    unlinkDetailsSource,
} from '../lib/series-details.js';
import { schemaValidator } from '../lib/validator.js';
import { requireRole } from '../middleware/require-role.js';
import { Hono } from 'hono';
import { z } from 'zod';

const DetailsSearchQuerySchema = z.object({
    source: DetailsSourceSchema,
    q: z.string().trim().min(1).max(200),
});

// Series are shared by everyone, so only admins can change them.
const series = new Hono<AppEnv>()
    .get(
        '/details-source/search',
        requireRole(UserRole.Admin),
        schemaValidator('query', DetailsSearchQuerySchema),
        async (c) => {
            const { source, q } = c.req.valid('query');
            return c.json(await searchDetailsSource(source, q));
        }
    )
    .put(
        '/:id/details-source',
        requireRole(UserRole.Admin),
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', LinkDetailsSourceSchema),
        async (c) => {
            await linkDetailsSource(
                c.req.valid('param').id,
                c.req.valid('json')
            );
            return c.body(null, 204);
        }
    )
    .delete(
        '/:id/details-source',
        requireRole(UserRole.Admin),
        schemaValidator('param', IdParamSchema),
        async (c) => {
            await unlinkDetailsSource(c.req.valid('param').id);
            return c.body(null, 204);
        }
    )
    .put(
        '/:id/volume-count',
        requireRole(UserRole.Admin),
        schemaValidator('param', IdParamSchema),
        schemaValidator('json', SetVolumeCountSchema),
        async (c) => {
            await setVolumeCount(
                c.req.valid('param').id,
                c.req.valid('json').volumeCount
            );
            return c.body(null, 204);
        }
    )
    // Series you can find: verified ones, and ones you created.
    .get('/', schemaValidator('query', SeriesSearchQuerySchema), async (c) => {
        const { q, ...page } = c.req.valid('query');
        return c.json(
            await searchSeries(page, q, discoverableSeries(c.get('user').id))
        );
    });

export default series;
