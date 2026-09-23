import { asc, desc, schema, sql } from '@analog/db';
import {
    DetailsSourceSchema,
    LinkDetailsSourceSchema,
    PageQuerySchema,
} from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { seriesColumns } from '../lib/books.js';
import { db } from '../lib/init.js';
import { paginate } from '../lib/pagination.js';
import {
    matchesAllTerms,
    relevance,
    searchTerms,
    withoutNumbers,
} from '../lib/search.js';
import {
    linkDetailsSource,
    searchDetailsSource,
    unlinkDetailsSource,
} from '../lib/series-details.js';
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { z } from 'zod';

const SearchQuerySchema = PageQuerySchema.extend({
    q: z.string().trim().max(200).optional(),
});
const DetailsSearchQuerySchema = z.object({
    source: DetailsSourceSchema,
    q: z.string().trim().min(1).max(200),
});
const SeriesParamSchema = z.object({ id: z.uuid('Invalid id') });

// Series are shared like the rest of the catalog, so anyone can link one.
const series = new Hono<AppEnv>()
    .get(
        '/details-source/search',
        schemaValidator('query', DetailsSearchQuerySchema),
        async (c) => {
            const { source, q } = c.req.valid('query');
            return c.json(await searchDetailsSource(source, q));
        }
    )
    .put(
        '/:id/details-source',
        schemaValidator('param', SeriesParamSchema),
        schemaValidator('json', LinkDetailsSourceSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { source, sourceId, volumeCount } = c.req.valid('json');
            await linkDetailsSource(id, source, sourceId, volumeCount);
            return c.body(null, 204);
        }
    )
    .delete(
        '/:id/details-source',
        schemaValidator('param', SeriesParamSchema),
        async (c) => {
            await unlinkDetailsSource(c.req.valid('param').id);
            return c.body(null, 204);
        }
    )
    .get('/', schemaValidator('query', SearchQuerySchema), async (c) => {
        const { q, ...page } = c.req.valid('query');
        const title = schema.series.title;
        const terms = withoutNumbers(searchTerms(q ?? ''));

        const result = await paginate(page, (limit, offset) =>
            db()
                .select(seriesColumns)
                .from(schema.series)
                .where(matchesAllTerms(terms, { columns: [title] }))
                .orderBy(
                    ...(terms.length
                        ? [desc(relevance(terms.join(' '), [title]))]
                        : []),
                    sql`lower(${title})`,
                    asc(schema.series.id)
                )
                .limit(limit)
                .offset(offset)
        );
        return c.json(result);
    });

export default series;
