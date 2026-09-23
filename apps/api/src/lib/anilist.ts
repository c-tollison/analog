import type { DetailsSearchResult, SeriesDetails } from './series-details.js';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const API_URL = 'https://graphql.anilist.co';
const TIMEOUT_MS = 8_000;
const SEARCH_LIMIT = 8;
const MEDIA_ID = /^\d+$/;

const FORMAT_LABELS: Record<string, string> = {
    MANGA: 'Manga',
    NOVEL: 'Light novel',
    ONE_SHOT: 'One-shot',
};

const STATUS_LABELS: Record<string, string> = {
    FINISHED: 'Finished',
    RELEASING: 'Ongoing',
    HIATUS: 'On hiatus',
    CANCELLED: 'Cancelled',
    NOT_YET_RELEASED: 'Not released yet',
};

const TitleSchema = z.object({
    english: z.string().nullable(),
    romaji: z.string().nullable(),
});

const DateSchema = z.object({ year: z.number().nullable() });

const SearchResultSchema = z.object({
    data: z.object({
        Page: z.object({
            media: z.array(
                z.object({
                    id: z.number(),
                    format: z.string().nullable(),
                    status: z.string().nullable(),
                    volumes: z.number().nullable(),
                    title: TitleSchema,
                    startDate: DateSchema,
                    coverImage: z.object({ medium: z.string().nullable() }),
                })
            ),
        }),
    }),
});

const MediaSchema = z.object({
    data: z.object({
        Media: z
            .object({
                id: z.number(),
                title: TitleSchema,
                description: z.string().nullable(),
                genres: z.array(z.string()).nullable(),
                status: z.string().nullable(),
                averageScore: z.number().nullable(),
                startDate: DateSchema,
                endDate: DateSchema,
                siteUrl: z.string(),
            })
            .nullable(),
    }),
});

async function query(document: string, variables: Record<string, unknown>) {
    let res: Response;
    try {
        res = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ query: document, variables }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch {
        throw new HTTPException(502, {
            message: 'AniList is unreachable. Try again shortly.',
        });
    }
    if (res.status === 429) {
        throw new HTTPException(503, {
            message: 'AniList is busy. Try again in a minute.',
        });
    }
    // AniList answers a missing id with a 404 and a null Media.
    if (!res.ok && res.status !== 404) {
        throw new HTTPException(502, {
            message: `AniList returned ${res.status}`,
        });
    }
    return res.json();
}

function titleOf(title: z.infer<typeof TitleSchema>): string {
    return title.english ?? title.romaji ?? 'Untitled';
}

const ENTITIES: Record<string, string> = {
    '&amp;': '&',
    '&quot;': '"',
    '&#039;': "'",
    '&lt;': '<',
    '&gt;': '>',
};

// Descriptions come with some HTML even when asking for plain text.
function plainText(html: string | null): string | null {
    if (!html) {
        return null;
    }
    const text = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&(amp|quot|#039|lt|gt);/g, (entity) => ENTITIES[entity] ?? '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return text || null;
}

/** Manga and light novels matching a title. */
export async function searchManga(
    search: string
): Promise<DetailsSearchResult[]> {
    const parsed = SearchResultSchema.safeParse(
        await query(
            `query ($search: String, $perPage: Int) {
                Page(perPage: $perPage) {
                    media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
                        id format status volumes
                        title { english romaji }
                        startDate { year }
                        coverImage { medium }
                    }
                }
            }`,
            { search, perPage: SEARCH_LIMIT }
        )
    );
    if (!parsed.success) {
        throw new HTTPException(502, {
            message: 'AniList sent something unexpected',
        });
    }
    return parsed.data.data.Page.media.map((media) => ({
        id: String(media.id),
        title: titleOf(media.title),
        format: media.format ? (FORMAT_LABELS[media.format] ?? null) : null,
        volumes: media.volumes,
        startYear: media.startDate.year,
        coverUrl: media.coverImage.medium,
    }));
}

/** One manga's details, or null if AniList has no such id. */
export async function getManga(id: string): Promise<SeriesDetails | null> {
    if (!MEDIA_ID.test(id)) {
        return null;
    }
    const parsed = MediaSchema.safeParse(
        await query(
            `query ($id: Int) {
                Media(id: $id, type: MANGA) {
                    id description(asHtml: false) genres status averageScore
                    siteUrl
                    title { english romaji }
                    startDate { year }
                    endDate { year }
                }
            }`,
            { id: Number(id) }
        )
    );
    if (!parsed.success) {
        throw new HTTPException(502, {
            message: 'AniList sent something unexpected',
        });
    }
    const media = parsed.data.data.Media;
    if (!media) {
        return null;
    }
    return {
        title: titleOf(media.title),
        description: plainText(media.description),
        genres: media.genres ?? [],
        status: media.status ? (STATUS_LABELS[media.status] ?? null) : null,
        ongoing: media.status === 'RELEASING',
        score: media.averageScore,
        startYear: media.startDate.year,
        endYear: media.endDate.year,
        url: media.siteUrl,
    };
}
