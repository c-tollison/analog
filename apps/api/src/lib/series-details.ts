import { eq, schema } from '@analog/db';
import {
    DETAILS_SOURCE_INFO,
    type DetailsSource,
    DetailsSourceSchema,
    ExternalSource,
    type LinkDetailsSourceSchema,
} from '@analog/types';

import { getManga, searchManga } from './anilist.js';
import { filledFacts, filledLinks } from './details.js';
import { db, logger } from './init.js';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

type Series = typeof schema.series.$inferSelect;

// Linked details are refreshed this often, so ongoing series stay current.
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

// What's stored in `series.details`, whichever source it came from.
const SeriesDetailsSchema = z.object({
    title: z.string().catch(''),
    description: z.string().nullable().catch(null),
    genres: z.array(z.string()).catch([]),
    status: z.string().nullable().catch(null),
    ongoing: z.boolean().catch(false),
    score: z.number().nullable().catch(null),
    startYear: z.number().nullable().catch(null),
    endYear: z.number().nullable().catch(null),
    url: z.string().nullable().catch(null),
});

export type SeriesDetails = z.infer<typeof SeriesDetailsSchema>;

export type DetailsSearchResult = {
    id: string;
    title: string;
    format: string | null;
    volumes: number | null;
    startYear: number | null;
    coverUrl: string | null;
};

// How to search each source and fetch one entry. Labels and the kinds each
// source covers live in DETAILS_SOURCE_INFO, shared with the web app.
const PROVIDERS: Record<
    DetailsSource,
    {
        search: (q: string) => Promise<DetailsSearchResult[]>;
        fetch: (id: string) => Promise<SeriesDetails | null>;
    }
> = {
    [ExternalSource.AniList]: { search: searchManga, fetch: getManga },
};

/** The series' source, if it's linked to one that covers its kind. */
function linkedSource(series: Series): DetailsSource | null {
    const parsed = DetailsSourceSchema.safeParse(series.detailsSource);
    return parsed.success &&
        series.detailsId &&
        DETAILS_SOURCE_INFO[parsed.data].kinds.includes(series.kind)
        ? parsed.data
        : null;
}

const refreshing = new Set<string>();

/**
 * Pulls fresh details in the background so the page never waits on the
 * source. A source that dropped the entry keeps what we had.
 */
async function refreshSeriesDetails(
    series: Series,
    source: DetailsSource,
    id: string
): Promise<void> {
    if (refreshing.has(series.id)) {
        return;
    }
    refreshing.add(series.id);
    try {
        const details = await PROVIDERS[source].fetch(id);
        await db()
            .update(schema.series)
            .set({
                ...(details ? { details: { ...details } } : {}),
                detailsFetchedAt: new Date(),
            })
            .where(eq(schema.series.id, series.id));
    } catch (error) {
        logger().warn(
            { error, seriesId: series.id },
            'Series details refresh failed'
        );
    } finally {
        refreshing.delete(series.id);
    }
}

/** What a series page shows beyond its own title and cover. */
export function seriesDetails(series: Series) {
    const source = linkedSource(series);
    const sourceId = source ? series.detailsId : null;
    const details = sourceId ? SeriesDetailsSchema.parse(series.details) : null;

    const fetchedAt = series.detailsFetchedAt?.getTime() ?? 0;
    if (source && sourceId && Date.now() - fetchedAt >= REFRESH_AFTER_MS) {
        void refreshSeriesDetails(series, source, sourceId);
    }

    const run = details?.startYear
        ? details.endYear && details.endYear !== details.startYear
            ? `${details.startYear}–${details.endYear}`
            : details.ongoing
              ? `${details.startYear}–`
              : String(details.startYear)
        : null;
    const label = source ? DETAILS_SOURCE_INFO[source].label : null;

    return {
        detailsSource: source,
        detailsId: sourceId,
        detailsTitle: details?.title || null,
        volumeCount: series.volumeCount,
        description: details?.description ?? null,
        genres: details?.genres ?? [],
        facts: filledFacts([
            { label: 'Status', value: details?.status },
            { label: 'Published', value: run },
            {
                label: `${label} score`,
                value: details?.score ? `${details.score}%` : null,
            },
        ]),
        links: filledLinks(label ? [{ label, url: details?.url }] : []),
    };
}

export function searchDetailsSource(source: DetailsSource, q: string) {
    return PROVIDERS[source].search(q);
}

async function requireSeries(seriesId: string) {
    const series = await db().query.series.findFirst({
        columns: { kind: true },
        where: eq(schema.series.id, seriesId),
    });
    if (!series) {
        throw new HTTPException(404, { message: 'Series not found' });
    }
    return series;
}

export async function linkDetailsSource(
    seriesId: string,
    { source, sourceId, volumeCount }: z.output<typeof LinkDetailsSourceSchema>
): Promise<void> {
    const { label, kinds } = DETAILS_SOURCE_INFO[source];
    const series = await requireSeries(seriesId);
    if (!kinds.includes(series.kind)) {
        throw new HTTPException(400, {
            message: `${label} doesn't cover this kind of series`,
        });
    }
    const details = await PROVIDERS[source].fetch(sourceId);
    if (!details) {
        throw new HTTPException(404, { message: `Not found on ${label}` });
    }
    await db()
        .update(schema.series)
        .set({
            detailsSource: source,
            detailsId: sourceId,
            details: { ...details },
            detailsFetchedAt: new Date(),
            volumeCount,
            updatedAt: new Date(),
        })
        .where(eq(schema.series.id, seriesId));
}

/** Drops the link. The total volume count stays, since people set it. */
export async function unlinkDetailsSource(seriesId: string): Promise<void> {
    await requireSeries(seriesId);
    await db()
        .update(schema.series)
        .set({
            detailsSource: null,
            detailsId: null,
            details: {},
            detailsFetchedAt: null,
            updatedAt: new Date(),
        })
        .where(eq(schema.series.id, seriesId));
}

export async function setVolumeCount(
    seriesId: string,
    volumeCount: number | null
): Promise<void> {
    await requireSeries(seriesId);
    await db()
        .update(schema.series)
        .set({ volumeCount, updatedAt: new Date() })
        .where(eq(schema.series.id, seriesId));
}
