import { ExternalSource, normalizeIsbn } from '@analog/types';

import { plainText } from './details.js';
import { config } from './init.js';
import {
    type BookLookup,
    bookKind,
    parseReleaseDate,
    parseVolume,
    seriesFromTitle,
} from './open-library.js';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const BASE_URL = 'https://www.googleapis.com/books/v1';
const TIMEOUT_MS = 8_000;
const VOLUME_ID = /^[\w-]+$/;
const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

const VolumeSchema = z.object({
    id: z.string(),
    volumeInfo: z.object({
        title: z.string(),
        subtitle: z.string().optional(),
        authors: z.array(z.string()).optional(),
        publisher: z.string().optional(),
        publishedDate: z.string().optional(),
        description: z.string().optional(),
        industryIdentifiers: z
            .array(z.object({ type: z.string(), identifier: z.string() }))
            .optional(),
        pageCount: z.number().optional(),
        categories: z.array(z.string()).optional(),
        imageLinks: z.record(z.string(), z.string()).optional(),
        language: z.string().optional(),
        seriesInfo: z
            .object({ bookDisplayNumber: z.string().optional() })
            .optional(),
    }),
});

type Volume = z.infer<typeof VolumeSchema>;

const SearchSchema = z.object({ items: z.array(VolumeSchema).optional() });

// Largest first. Search results only carry the two thumbnails.
const IMAGE_SIZES = ['large', 'medium', 'small', 'thumbnail'];

async function getJson(path: string, apiKey: string): Promise<unknown> {
    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set('key', apiKey);
    let res: Response;
    try {
        res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
        throw new HTTPException(502, {
            message: 'Google Books is unreachable. Try again shortly.',
        });
    }
    if (res.status === 404) {
        return null;
    }
    if (res.status === 429) {
        throw new HTTPException(503, {
            message: 'Google Books is busy. Try again in a few seconds.',
        });
    }
    if (!res.ok) {
        throw new HTTPException(502, {
            message: `Google Books returned ${res.status}`,
        });
    }
    return res.json();
}

// Search matches loosely, so only take a volume that lists this ISBN.
function hasIsbn(volume: Volume, isbn: string): boolean {
    return (volume.volumeInfo.industryIdentifiers ?? []).some(
        ({ identifier }) => normalizeIsbn(identifier) === isbn
    );
}

const COVER_URL = /^https:\/\/books\.google\.com\//;

/** Whether a stored cover came from Google Books. */
export function isGoogleBooksCover(url: string | null): boolean {
    return !!url && COVER_URL.test(url);
}

function coverUrl(imageLinks: Record<string, string> | undefined) {
    const url = IMAGE_SIZES.map((size) => imageLinks?.[size]).find(Boolean);
    return url?.replace(/^http:/, 'https:').replace('&edge=curl', '') ?? null;
}

function languageName(code: string | undefined): string | null {
    if (!code) {
        return null;
    }
    try {
        const name = languageNames.of(code);
        return name && name !== code ? name : null;
    } catch {
        return null;
    }
}

// Categories are paths like "Comics & Graphic Novels / Manga / Fantasy". The
// last part is the genre.
function genres(categories: string[] | undefined): string[] {
    const names = (categories ?? [])
        .map((category) => category.split('/').at(-1)?.trim() ?? '')
        .filter((name) => name && name !== 'General');
    return [...new Set(names)];
}

function displayNumber(volume: Volume): number | null {
    const number = Number(volume.volumeInfo.seriesInfo?.bookDisplayNumber);
    return Number.isFinite(number) && number > 0 ? number : null;
}

/** Looks up an ISBN on Google Books. Returns null when there's no match. */
export async function lookupGoogleBooksIsbn(
    isbn: string
): Promise<{ book: BookLookup; complete: boolean } | null> {
    const { apiKey } = config().googleBooks;

    const search = SearchSchema.safeParse(
        await getJson(`/volumes?q=isbn:${isbn}`, apiKey)
    );
    const found = search.data?.items?.find((item) => hasIsbn(item, isbn));
    if (!found || !VOLUME_ID.test(found.id)) {
        return null;
    }
    // The full record has larger covers and the whole description.
    const full = VolumeSchema.safeParse(
        await getJson(`/volumes/${found.id}`, apiKey)
    );
    const volume = full.data ?? found;
    const info = volume.volumeInfo;
    const publishers = info.publisher ? [info.publisher] : [];
    const language = languageName(info.language);
    const number = displayNumber(volume);

    return {
        book: {
            isbn,
            title: info.title,
            subtitle: info.subtitle ?? null,
            authors: info.authors ?? [],
            publishers,
            publishDate: info.publishedDate ?? null,
            firstPublishYear: null,
            pageCount: info.pageCount || null,
            description: plainText(info.description),
            characters: [],
            editionName: null,
            physicalFormat: null,
            languages: language ? [language] : [],
            goodreadsId: null,
            genres: genres(info.categories),
            releaseDate: parseReleaseDate(info.publishedDate),
            kind: bookKind({ subjects: info.categories, publishers }),
            // Google only knows a series by id, so name it from the title.
            // A numbered volume's title is often just the series name.
            series: seriesFromTitle(info.title) ?? (number ? info.title : null),
            volume: parseVolume(info.title, null) ?? number,
            coverUrl: coverUrl(info.imageLinks),
            source: ExternalSource.GoogleBooks,
            sourceId: volume.id,
        },
        complete: true,
    };
}
