import { asc, desc, schema, sql } from '@analog/db';
import { PageQuerySchema } from '@analog/types';

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
import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { z } from 'zod';

const SearchQuerySchema = PageQuerySchema.extend({
    q: z.string().trim().max(200).optional(),
});

const series = new Hono<AppEnv>().get(
    '/',
    schemaValidator('query', SearchQuerySchema),
    async (c) => {
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
    }
);

export default series;
