import { asc, schema } from '@analog/db';

import type { AppEnv } from '../lib/app-env.js';
import { db } from '../lib/init.js';
import { Hono } from 'hono';

const { genre } = schema;

// Every genre, for pickers and filters. Subgenres name their parent.
const genres = new Hono<AppEnv>().get('/', async (c) =>
    c.json(
        await db()
            .select({
                slug: genre.slug,
                name: genre.name,
                parentSlug: genre.parentSlug,
                nonfiction: genre.nonfiction,
            })
            .from(genre)
            .orderBy(asc(genre.nonfiction), asc(genre.name))
    )
);

export default genres;
