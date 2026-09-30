import {
    ExternalSource,
    isoLanguage,
    languageName,
    normalizeIsbn,
} from '@analog/types';

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

// Search results only carry small thumbnails. Open Library's cover is used
// when it has one.
function coverUrl(imageLinks: Record<string, string> | undefined) {
    const url = imageLinks?.thumbnail ?? imageLinks?.smallThumbnail;
    return url?.replace(/^http:/, 'https:').replace('&edge=curl', '') ?? null;
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

/**
 * Looks up an ISBN on Google Books with one request. Returns null when
 * there's no match.
 */
export async function lookupGoogleBooksIsbn(
    isbn: string
): Promise<BookLookup | null> {
    const { apiKey } = config().googleBooks;

    const search = SearchSchema.safeParse(
        await getJson(`/volumes?q=isbn:${isbn}`, apiKey)
    );
    const volume = search.data?.items?.find((item) => hasIsbn(item, isbn));
    if (!volume) {
        return null;
    }
    const info = volume.volumeInfo;
    const publishers = info.publisher ? [info.publisher] : [];
    const language = languageName(info.language);
    const number = displayNumber(volume);

    return {
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
        language: info.language ? isoLanguage(info.language) : null,
        coverUrl: coverUrl(info.imageLinks),
        source: ExternalSource.GoogleBooks,
        sourceId: volume.id,
    };
}

// Google sends at most 20 results a request, even when asked for more.
const PAGE_SIZE = 20;

interface SearchOptions {
    offset?: number;
    // An ISO 639-1 code, like "en".
    lang?: string;
}

async function searchVolumes(
    query: string,
    { offset = 0, lang }: SearchOptions
): Promise<Volume[]> {
    const params = new URLSearchParams({
        q: query,
        printType: 'books',
        maxResults: String(PAGE_SIZE),
        startIndex: String(offset),
    });
    if (lang) {
        params.set('langRestrict', lang);
    }
    const { apiKey } = config().googleBooks;
    const search = SearchSchema.safeParse(
        await getJson(`/volumes?${params}`, apiKey)
    );
    return search.data?.items ?? [];
}

function firstIsbn(volume: Volume): string | null {
    for (const { identifier } of volume.volumeInfo.industryIdentifiers ?? []) {
        const isbn = normalizeIsbn(identifier);
        if (isbn) {
            return isbn;
        }
    }
    return null;
}

// Same title and language, ignoring case and punctuation.
function sameBookKey(volume: Volume): string {
    const { title, language } = volume.volumeInfo;
    const words = title.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    return `${words.join(' ')}|${language ?? ''}`;
}

function searchResult(volume: Volume, isbn: string) {
    const info = volume.volumeInfo;
    return {
        isbn,
        title: info.title,
        author: info.authors?.[0] ?? null,
        language: languageName(info.language),
        year: info.publishedDate?.match(/^\d{4}/)?.[0] ?? null,
        coverUrl: coverUrl(info.imageLinks),
        volume: parseVolume(info.title, null) ?? displayNumber(volume),
    };
}

type SearchResult = ReturnType<typeof searchResult>;

// Drops volumes with no ISBN and keeps one of each ISBN, and of each title
// in a language: the first Google ranked, or the first with a cover.
function cleanResults(volumes: Volume[]): SearchResult[] {
    const kept = new Map<string, SearchResult>();
    const isbns = new Set<string>();
    for (const volume of volumes) {
        const isbn = firstIsbn(volume);
        if (!isbn || isbns.has(isbn)) {
            continue;
        }
        isbns.add(isbn);
        const key = sameBookKey(volume);
        const found = kept.get(key);
        if (!found || (!found.coverUrl && volume.volumeInfo.imageLinks)) {
            kept.set(key, searchResult(volume, isbn));
        }
    }
    return [...kept.values()];
}

/**
 * Searches Google Books titles, a page at a time. When the first page isn't
 * full, the plain query's results come after it, which finds searches that
 * include an author's name.
 */
export async function searchGoogleBooks(q: string, options: SearchOptions) {
    const words = q
        .split(/\s+/)
        .map((word) => word.replace(/["':]/g, ''))
        .filter(Boolean);
    const offset = options.offset ?? 0;

    const byTitle = words.length
        ? await searchVolumes(
              words.map((word) => `intitle:${word}`).join(' '),
              options
          )
        : [];
    if (byTitle.length >= PAGE_SIZE) {
        return {
            items: cleanResults(byTitle),
            nextOffset: offset + PAGE_SIZE,
        };
    }
    // Later pages of the plain query are mostly unrelated books.
    const plain = offset === 0 ? await searchVolumes(q, options) : [];
    return { items: cleanResults([...byTitle, ...plain]), nextOffset: null };
}
