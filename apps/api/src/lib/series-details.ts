import { eq, schema } from '@analog/db';
import {
    type DetailsSource,
    DetailsSourceSchema,
    ExternalSource,
    SeriesKind,
} from '@analog/types';

import { getManga, searchManga } from './anilist.js';
import { db } from './init.js';
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

// Each source says which kinds of series it covers, how to search it and how
// to fetch one entry. CDs or vinyl get their own source here later.
const PROVIDERS: Record<
    DetailsSource,
    {
        label: string;
        kinds: SeriesKind[];
        search: (q: string) => Promise<DetailsSearchResult[]>;
        fetch: (id: string) => Promise<SeriesDetails | null>;
    }
> = {
    [ExternalSource.AniList]: {
        label: 'AniList',
        kinds: [SeriesKind.Manga, SeriesKind.LightNovel],
        search: searchManga,
        fetch: getManga,
    },
};

function readStored(series: Series): SeriesDetails {
    return SeriesDetailsSchema.catch({
        title: '',
        description: null,
        genres: [],
        status: null,
        ongoing: false,
        score: null,
        startYear: null,
        endYear: null,
        url: null,
    }).parse(series.details);
}

function linkedSource(series: Series): DetailsSource | null {
    const parsed = DetailsSourceSchema.safeParse(series.detailsSource);
    return parsed.success && series.detailsId ? parsed.data : null;
}

async function refresh(
    series: Series,
    source: DetailsSource,
    id: string
): Promise<SeriesDetails> {
    const stored = readStored(series);
    const fetchedAt = series.detailsFetchedAt?.getTime() ?? 0;
    if (Date.now() - fetchedAt < REFRESH_AFTER_MS) {
        return stored;
    }
    try {
        // Null means the source dropped the entry. Keep what we had, and wait
        // as long as usual before asking again.
        const details = (await PROVIDERS[source].fetch(id)) ?? stored;
        await db()
            .update(schema.series)
            .set({ details: { ...details }, detailsFetchedAt: new Date() })
            .where(eq(schema.series.id, series.id));
        return details;
    } catch {
        // The source is down. Show what we have; the next visit retries.
        return stored;
    }
}

/** What a series page shows beyond its own title and cover. */
export async function seriesDetails(series: Series) {
    const source = linkedSource(series);
    const details =
        source && series.detailsId
            ? await refresh(series, source, series.detailsId)
            : null;

    const run = details?.startYear
        ? details.endYear && details.endYear !== details.startYear
            ? `${details.startYear}–${details.endYear}`
            : details.ongoing
              ? `${details.startYear}–`
              : String(details.startYear)
        : null;
    const facts = [
        { label: 'Status', value: details?.status },
        { label: 'Published', value: run },
        {
            label: source ? `${PROVIDERS[source].label} score` : 'Score',
            value: details?.score ? `${details.score}%` : null,
        },
    ];

    return {
        detailsSource: source,
        detailsId: source ? series.detailsId : null,
        detailsTitle: details?.title || null,
        volumeCount: series.volumeCount,
        description: details?.description ?? null,
        genres: details?.genres ?? [],
        facts: facts.filter(
            (fact): fact is { label: string; value: string } => !!fact.value
        ),
        links:
            source && details?.url
                ? [{ label: PROVIDERS[source].label, url: details.url }]
                : [],
    };
}

export function searchDetailsSource(source: DetailsSource, q: string) {
    return PROVIDERS[source].search(q);
}

export async function linkDetailsSource(
    seriesId: string,
    source: DetailsSource,
    sourceId: string,
    volumeCount: number | null
): Promise<void> {
    const provider = PROVIDERS[source];
    const series = await db().query.series.findFirst({
        columns: { kind: true },
        where: eq(schema.series.id, seriesId),
    });
    if (!series) {
        throw new HTTPException(404, { message: 'Series not found' });
    }
    if (!provider.kinds.includes(series.kind)) {
        throw new HTTPException(400, {
            message: `${provider.label} doesn't cover this kind of series`,
        });
    }
    const details = await provider.fetch(sourceId);
    if (!details) {
        throw new HTTPException(404, {
            message: `Not found on ${provider.label}`,
        });
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

export async function unlinkDetailsSource(seriesId: string): Promise<void> {
    const [updated] = await db()
        .update(schema.series)
        .set({
            detailsSource: null,
            detailsId: null,
            details: {},
            detailsFetchedAt: null,
            volumeCount: null,
            updatedAt: new Date(),
        })
        .where(eq(schema.series.id, seriesId))
        .returning({ id: schema.series.id });
    if (!updated) {
        throw new HTTPException(404, { message: 'Series not found' });
    }
}
