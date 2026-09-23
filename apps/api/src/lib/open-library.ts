import { ExternalSource, SeriesKind } from '@analog/types';

import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const BASE_URL = 'https://openlibrary.org';
const COVERS_URL = 'https://covers.openlibrary.org';
const TIMEOUT_MS = 8_000;
// Open Library asks clients to identify themselves.
const HEADERS = { 'User-Agent': 'Analog (physical media tracker)' };

const EditionSchema = z.object({
    key: z.string(),
    title: z.string(),
    subtitle: z.string().optional(),
    authors: z.array(z.object({ key: z.string() })).optional(),
    contributors: z
        .array(z.object({ name: z.string(), role: z.string().optional() }))
        .optional(),
    by_statement: z.string().optional(),
    publishers: z.array(z.string()).optional(),
    publish_date: z.string().optional(),
    number_of_pages: z.number().optional(),
    series: z.array(z.string()).optional(),
    covers: z.array(z.number()).optional(),
    subjects: z.array(z.string()).optional(),
});

const AuthorSchema = z.object({ name: z.string() });
const AUTHOR_KEY = /^\/authors\/OL\d+A$/;

const MANGA_SUBJECTS = /manga|comic|graphic novel/i;
const MANGA_PUBLISHERS =
    /viz|shonen jump|shojo beat|yen press|kodansha|seven seas|tokyopop|dark horse manga|square enix manga|vertical/i;

function looksLikeManga(edition: z.infer<typeof EditionSchema>): boolean {
    return (
        !!edition.subjects?.some((s) => MANGA_SUBJECTS.test(s)) ||
        !!edition.publishers?.some((p) => MANGA_PUBLISHERS.test(p))
    );
}

async function getJson(path: string): Promise<unknown | null> {
    let res: Response;
    try {
        res = await fetch(`${BASE_URL}${path}`, {
            headers: HEADERS,
            redirect: 'follow',
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch {
        throw new HTTPException(502, {
            message: 'Open Library is unreachable. Try again shortly.',
        });
    }
    if (res.status === 404) {
        return null;
    }
    if (!res.ok) {
        throw new HTTPException(502, {
            message: `Open Library returned ${res.status}`,
        });
    }
    return res.json();
}

async function getAuthorName(key: string): Promise<string | null> {
    // The key comes from Open Library's response and is appended to our URL,
    // so only allow the expected shape, e.g. "/authors/OL123A".
    if (!AUTHOR_KEY.test(key)) {
        return null;
    }
    try {
        const parsed = AuthorSchema.safeParse(await getJson(`${key}.json`));
        return parsed.success ? parsed.data.name : null;
    } catch {
        return null;
    }
}

// Catalogers write series inconsistently: "Haikyu!!", "Haikyu!!, v. 40",
// "Haikyu!! ; 40". Strip the trailing volume designation.
export function cleanSeriesName(raw: string): string {
    return raw
        .replace(/\s*[,;#]\s*(v\.|vol\.?|volume|no\.)?\s*\d+(\.\d+)?\s*$/i, '')
        .replace(/\s*\((v\.|vol\.?|volume)?\s*\d+(\.\d+)?\)\s*$/i, '')
        .trim();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Volume numbers only live in the title, e.g. "Haikyu!! 1: Hinata and Kageyama"
// or "One Piece, Vol. 3".
export function parseVolume(
    title: string,
    rawSeries: string | null
): number | null {
    const explicit = title.match(/\b(?:vol\.?|volume|v\.)\s*(\d+(?:\.\d+)?)/i);
    if (explicit?.[1]) {
        return Number(explicit[1]);
    }

    const fromSeries = rawSeries?.match(
        /[,;#(]\s*(?:v\.|vol\.?|volume|no\.)?\s*(\d+(?:\.\d+)?)\)?\s*$/i
    );
    if (fromSeries?.[1]) {
        return Number(fromSeries[1]);
    }

    if (rawSeries) {
        const name = escapeRegExp(cleanSeriesName(rawSeries));
        const afterSeries = title.match(
            new RegExp(`^${name}[\\s,#:]*(\\d+(?:\\.\\d+)?)\\b`, 'i')
        );
        if (afterSeries?.[1]) {
            return Number(afterSeries[1]);
        }
    }

    return null;
}

// Open Library dates are free text: "2016", "2019-06-04", "June 4, 2019".
export function parseReleaseDate(raw: string | undefined): string | null {
    if (!raw) {
        return null;
    }
    const year = raw.trim().match(/^\d{4}$/);
    if (year) {
        return `${year[0]}-01-01`;
    }
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed)
        ? null
        : new Date(parsed).toISOString().slice(0, 10);
}

export type BookLookup = NonNullable<Awaited<ReturnType<typeof lookupIsbn>>>;

export async function lookupIsbn(isbn: string) {
    const parsed = EditionSchema.safeParse(await getJson(`/isbn/${isbn}.json`));
    if (!parsed.success) {
        return null;
    }
    const edition = parsed.data;

    const authorNames = await Promise.all(
        (edition.authors ?? []).map((author) => getAuthorName(author.key))
    );
    const authors = authorNames.filter((name): name is string => !!name);
    if (authors.length === 0 && edition.contributors) {
        authors.push(...new Set(edition.contributors.map((c) => c.name)));
    }
    if (authors.length === 0 && edition.by_statement) {
        authors.push(edition.by_statement);
    }

    const rawSeries = edition.series?.[0] ?? null;
    const coverId = edition.covers?.find((id) => id > 0);

    return {
        isbn,
        title: edition.title,
        subtitle: edition.subtitle ?? null,
        authors,
        publishers: edition.publishers ?? [],
        publishDate: edition.publish_date ?? null,
        releaseDate: parseReleaseDate(edition.publish_date),
        pageCount: edition.number_of_pages ?? null,
        kind: looksLikeManga(edition) ? SeriesKind.Manga : SeriesKind.Book,
        series: rawSeries ? cleanSeriesName(rawSeries) : null,
        volume: parseVolume(edition.title, rawSeries),
        coverUrl: coverId ? `${COVERS_URL}/b/id/${coverId}-L.jpg` : null,
        source: ExternalSource.OpenLibrary,
        sourceId: edition.key.replace('/books/', ''),
    };
}
