import { asc, count, desc, eq, schema } from '@analog/db';
import { AUDIENCE_LABELS } from '@analog/types';

import { filledFacts } from './details.js';
import { db } from './init.js';
import { HTTPException } from 'hono/http-exception';

/** The genres a series' volumes have, the most used first. */
export async function volumeGenres(seriesId: string) {
    const { catalogItem, catalogItemGenre, genre } = schema;
    return db()
        .select({ slug: genre.slug, name: genre.name })
        .from(catalogItemGenre)
        .innerJoin(
            catalogItem,
            eq(catalogItem.id, catalogItemGenre.catalogItemId)
        )
        .innerJoin(genre, eq(genre.slug, catalogItemGenre.genreSlug))
        .where(eq(catalogItem.seriesId, seriesId))
        .groupBy(genre.slug, genre.name)
        .orderBy(desc(count()), asc(genre.name));
}

type Series = Pick<
    typeof schema.series.$inferSelect,
    'volumeCount' | 'description' | 'audience'
>;

/** What a series page shows beyond its title, cover and volumes. */
export function seriesDetails(series: Series) {
    return {
        volumeCount: series.volumeCount,
        description: series.description,
        facts: filledFacts([
            {
                label: 'Audience',
                value: series.audience && AUDIENCE_LABELS[series.audience],
            },
        ]),
    };
}

/** Sets how many volumes a series has in total, or null when unknown. */
export async function setVolumeCount(
    seriesId: string,
    volumeCount: number | null
): Promise<void> {
    const [updated] = await db()
        .update(schema.series)
        .set({ volumeCount, updatedAt: new Date() })
        .where(eq(schema.series.id, seriesId))
        .returning({ id: schema.series.id });
    if (!updated) {
        throw new HTTPException(404, { message: 'Series not found' });
    }
}
