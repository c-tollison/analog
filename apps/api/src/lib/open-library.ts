import { ExternalSource, SeriesKind } from '@analog/types';

import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const BASE_URL = 'https://openlibrary.org';
const COVERS_URL = 'https://covers.openlibrary.org';
const TIMEOUT_MS = 8_000;
// Naming the app and a contact email gets 3 requests/second instead of 1.
const HEADERS = { 'User-Agent': 'Analog/1.0 (tollison.carson@gmail.com)' };

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
    works: z.array(z.object({ key: z.string() })).optional(),
    description: z
        .union([z.string(), z.object({ value: z.string() })])
        .optional(),
    edition_name: z.string().optional(),
    physical_format: z.string().optional(),
    languages: z.array(z.object({ key: z.string() })).optional(),
    identifiers: z
        .object({ goodreads: z.array(z.string()).optional() })
        .optional(),
});

type Edition = z.infer<typeof EditionSchema>;

const WorkSchema = EditionSchema.pick({ subjects: true, description: true });

const AuthorSchema = z.object({
    name: z.string(),
    personal_name: z.string().optional(),
    alternate_names: z.array(z.string()).optional(),
});

const SearchSchema = z.object({
    docs: z.array(
        z.object({
            first_publish_year: z.number().optional(),
            subject: z.array(z.string()).optional(),
        })
    ),
});
const AUTHOR_KEY = /^\/authors\/OL\d+A$/;
const WORK_KEY = /^\/works\/OL\d+W$/;
const MAX_CHARACTERS = 8;
const FICTIONAL_CHARACTER = /\s*\(fictitious character\)\s*$/i;
// Anything outside the Latin alphabet, ignoring spaces, punctuation and accents.
const NON_LATIN = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;
const LANGUAGE_KEY = /^\/languages\/([a-z]{3})$/;
const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

const LIGHT_NOVEL_SUBJECTS = /light novel/i;
const LIGHT_NOVEL_PUBLISHERS = /yen on|j-novel|airship/i;
const MANGA_SUBJECTS = /manga|comic|graphic novel/i;
const MANGA_PUBLISHERS =
    /viz|shonen jump|shojo beat|yen press|kodansha|seven seas|tokyopop|dark horse manga|square enix manga|vertical/i;

function matches(values: string[] | undefined, pattern: RegExp): boolean {
    return !!values?.some((value) => pattern.test(value));
}

export function bookKind({
    subjects,
    publishers,
}: {
    subjects?: string[];
    publishers?: string[];
}): SeriesKind.Manga | SeriesKind.LightNovel | SeriesKind.Book {
    // Checked first: light novel imprints share publishers with manga.
    if (
        matches(subjects, LIGHT_NOVEL_SUBJECTS) ||
        matches(publishers, LIGHT_NOVEL_PUBLISHERS)
    ) {
        return SeriesKind.LightNovel;
    }
    if (
        matches(subjects, MANGA_SUBJECTS) ||
        matches(publishers, MANGA_PUBLISHERS)
    ) {
        return SeriesKind.Manga;
    }
    return SeriesKind.Book;
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
    if (res.status === 429) {
        throw new HTTPException(503, {
            message: 'Open Library is busy. Try again in a few seconds.',
        });
    }
    if (!res.ok) {
        throw new HTTPException(502, {
            message: `Open Library returned ${res.status}`,
        });
    }
    return res.json();
}

/**
 * An author's name as English readers know it. Some records keep the name in
 * its original script ("大久保篤") with the romanized one ("Atsushi Ōkubo") as
 * an alternate.
 */
async function getAuthorName(key: string): Promise<string | null> {
    // The key comes from Open Library's response and is appended to our URL,
    // so only allow the expected shape, e.g. "/authors/OL123A".
    if (!AUTHOR_KEY.test(key)) {
        return null;
    }
    const parsed = AuthorSchema.safeParse(await getJson(`${key}.json`));
    if (!parsed.success) {
        return null;
    }
    const { name, personal_name, alternate_names = [] } = parsed.data;
    return (
        [name, personal_name, ...alternate_names].find(
            (candidate) => candidate && !NON_LATIN.test(candidate)
        ) ?? name
    );
}

// Credits written on the edition itself, for when author records don't help.
function editionCredits(edition: Edition): string[] {
    if (edition.contributors?.length) {
        return [...new Set(edition.contributors.map((c) => c.name))];
    }
    return edition.by_statement ? [edition.by_statement] : [];
}

async function getAuthors(edition: Edition): Promise<string[]> {
    const names = await Promise.all(
        (edition.authors ?? []).map((author) => getAuthorName(author.key))
    );
    const authors = names.filter((name): name is string => !!name);
    return authors.length ? authors : editionCredits(edition);
}

async function getWork(edition: Edition): Promise<z.infer<typeof WorkSchema>> {
    const workKey = edition.works?.[0]?.key;
    if (!workKey || !WORK_KEY.test(workKey)) {
        return {};
    }
    const parsed = WorkSchema.safeParse(await getJson(`${workKey}.json`));
    return parsed.success ? parsed.data : {};
}

// Search results carry what's pooled across every edition of the book: the
// year it first came out, and fuller subjects that name its characters.
async function getSearchDoc(isbn: string) {
    const parsed = SearchSchema.safeParse(
        await getJson(
            `/search.json?q=isbn:${isbn}&fields=first_publish_year,subject&limit=1`
        )
    );
    return parsed.success ? (parsed.data.docs[0] ?? {}) : {};
}

function languageName(key: string): string | null {
    const code = key.match(LANGUAGE_KEY)?.[1];
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

// Skip filler like "1 edition" that says nothing about the edition.
function editionName(raw: string | undefined): string | null {
    const name = raw?.trim();
    return name && !/^\d+(st|nd|rd|th)? edition$/i.test(name) ? name : null;
}

function descriptionText(description: Edition['description']): string | null {
    const text =
        typeof description === 'string' ? description : description?.value;
    return text?.trim() || null;
}

function unique(values: string[], limit: number): string[] {
    const seen = new Set<string>();
    return values
        .map((value) => value.trim())
        .filter((value) => {
            const key = value.toLowerCase();
            if (!value || seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        })
        .slice(0, limit);
}

// Subjects are mostly library tags, but name characters like
// "Ichigo Kurosaki (Fictitious character)".
function characters(subjects: string[]): string[] {
    return unique(
        subjects
            .filter((subject) => FICTIONAL_CHARACTER.test(subject))
            .map((subject) => subject.replace(FICTIONAL_CHARACTER, '')),
        MAX_CHARACTERS
    );
}

/**
 * Everything about an edition beyond what identifies it. Open Library keeps
 * the description and subjects on the work more often than the edition, and
 * the first published year only in search, so those are checked too.
 * `complete` is false when one of those extra requests failed, so the
 * caller can try again later.
 */
async function getDetails(edition: Edition, isbn: string) {
    let complete = true;
    async function attempt<T>(request: Promise<T>, fallback: T): Promise<T> {
        try {
            return await request;
        } catch {
            complete = false;
            return fallback;
        }
    }

    const [authors, work, searchDoc] = await Promise.all([
        attempt(getAuthors(edition), editionCredits(edition)),
        attempt(getWork(edition), {}),
        attempt(getSearchDoc(isbn), {}),
    ]);
    const subjects = [
        ...(searchDoc.subject ?? []),
        ...(work.subjects ?? []),
        ...(edition.subjects ?? []),
    ];
    // Open Library's subjects are library tags, not genres.
    const genres: string[] = [];
    const details = {
        subtitle: edition.subtitle ?? null,
        authors,
        publishers: edition.publishers ?? [],
        publishDate: edition.publish_date ?? null,
        firstPublishYear: searchDoc.first_publish_year ?? null,
        pageCount: edition.number_of_pages ?? null,
        description:
            descriptionText(edition.description) ??
            descriptionText(work.description),
        characters: characters(subjects),
        editionName: editionName(edition.edition_name),
        physicalFormat: edition.physical_format?.trim() || null,
        languages: (edition.languages ?? [])
            .map((language) => languageName(language.key))
            .filter((name): name is string => !!name),
        goodreadsId: edition.identifiers?.goodreads?.[0] ?? null,
        genres,
    };
    return { details, complete };
}

export type BookDetails = Awaited<ReturnType<typeof getDetails>>['details'];

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

// A series name from a title that names its volume, e.g. "One Piece, Vol. 3".
export function seriesFromTitle(title: string): string | null {
    const match = title.match(/^(.+?)[\s,:;#]*\b(?:vol\.?|volume|v\.)\s*\d/i);
    return match?.[1]?.trim() || null;
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

export type BookLookup = NonNullable<
    Awaited<ReturnType<typeof lookupIsbn>>
>['book'];

export async function lookupIsbn(isbn: string) {
    const parsed = EditionSchema.safeParse(await getJson(`/isbn/${isbn}.json`));
    if (!parsed.success) {
        return null;
    }
    const edition = parsed.data;

    const { details, complete } = await getDetails(edition, isbn);
    const rawSeries = edition.series?.[0] ?? null;
    const coverId = edition.covers?.find((id) => id > 0);

    return {
        book: {
            isbn,
            title: edition.title,
            ...details,
            releaseDate: parseReleaseDate(edition.publish_date),
            kind: bookKind(edition),
            series: rawSeries
                ? cleanSeriesName(rawSeries)
                : seriesFromTitle(edition.title),
            volume: parseVolume(edition.title, rawSeries),
            coverUrl: coverId ? `${COVERS_URL}/b/id/${coverId}-L.jpg` : null,
            source: ExternalSource.OpenLibrary,
            sourceId: edition.key.replace('/books/', ''),
        },
        complete,
    };
}
