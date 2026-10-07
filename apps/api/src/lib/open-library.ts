import { ExternalSource, isoLanguage, SeriesKind } from '@analog/types';

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

const WorkSchema = EditionSchema.pick({ description: true }).extend({
    authors: z
        .array(z.object({ author: z.object({ key: z.string() }) }))
        .optional(),
});

const AuthorSchema = z.object({
    name: z.string(),
    personal_name: z.string().optional(),
    alternate_names: z.array(z.string()).optional(),
});

const SearchSchema = z.object({
    docs: z.array(
        z.object({
            first_publish_year: z.number().optional(),
        })
    ),
});
const AUTHOR_KEY = /^\/authors\/OL\d+A$/;
const WORK_KEY = /^\/works\/OL\d+W$/;
// Anything outside the Latin alphabet, ignoring spaces, punctuation and accents.
const NON_LATIN = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

/** Whether English readers can read it, e.g. "Atsushi Ōkubo" but not "大久保篤". */
export function isLatin(text: string): boolean {
    return !NON_LATIN.test(text);
}
const LANGUAGE_KEY = /^\/languages\/([a-z]{3})$/;

const LIGHT_NOVEL_SUBJECTS = /light novel/i;
const LIGHT_NOVEL_PUBLISHERS = /yen on|j-novel|airship/i;
const MANGA_SUBJECTS = /manga|comic|graphic novel/i;
const MANGA_PUBLISHERS =
    /viz|shonen jump|shojo beat|yen press|kodansha|seven seas|tokyopop|dark horse manga|square enix manga|vertical/i;

function matches(values: string[] | undefined, pattern: RegExp): boolean {
    return !!values?.some((value) => pattern.test(value));
}

// The kinds a book can be. Lookups only tell manga and light novels from
// other books, and admins set the rest.
export type BookKind =
    | SeriesKind.Manga
    | SeriesKind.LightNovel
    | SeriesKind.Book
    | SeriesKind.GraphicNovel
    | SeriesKind.ShortStories;

export function bookKind({
    subjects,
    publishers,
}: {
    subjects?: string[];
    publishers?: string[];
}): BookKind {
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
            (candidate) => candidate && isLatin(candidate)
        ) ?? name
    );
}

const TRANSLATOR = /translat/i;
const ILLUSTRATOR = /illustrat|artist/i;
// Contributors who didn't write the book.
const NOT_AUTHOR = /translat|illustrat|artist|editor|foreword|introduc/i;

// Contributors listed with a role like "Translator".
function contributorsAs(edition: Edition, role: RegExp): string[] {
    const names = (edition.contributors ?? [])
        .filter(
            (contributor) => contributor.role && role.test(contributor.role)
        )
        .map((contributor) => contributor.name);
    return [...new Set(names)];
}

// A name from a credit line like "translated from the Polish by Danuta
// Borchardt ; foreword by Susan Sontag".
function byStatementAs(edition: Edition, role: RegExp): string[] {
    const part = edition.by_statement
        ?.split(';')
        .find((text) => role.test(text));
    const name = part
        ?.match(/\bby\s+(.+)$/i)?.[1]
        ?.trim()
        .replace(/\.$/, '');
    return name ? [name] : [];
}

function creditsAs(edition: Edition, role: RegExp): string[] {
    const listed = contributorsAs(edition, role);
    return listed.length ? listed : byStatementAs(edition, role);
}

// Credits written on the edition itself, for when author records don't help.
function editionCredits(edition: Edition): string[] {
    const writers = (edition.contributors ?? [])
        .filter(
            (contributor) =>
                !contributor.role || !NOT_AUTHOR.test(contributor.role)
        )
        .map((contributor) => contributor.name);
    if (writers.length) {
        return [...new Set(writers)];
    }
    const line = edition.by_statement;
    return line && !NOT_AUTHOR.test(line) ? [line.replace(/\.$/, '')] : [];
}

async function authorNames(keys: string[]): Promise<string[]> {
    const names = await Promise.all(keys.map((key) => getAuthorName(key)));
    return names.filter((name): name is string => !!name);
}

async function getAuthors(edition: Edition): Promise<string[]> {
    const authors = await authorNames(
        (edition.authors ?? []).map((author) => author.key)
    );
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

// The code of an edition's first language.
// The code in a language key, like "eng" in "/languages/eng".
function keyCode(key: string): string | undefined {
    return key.match(LANGUAGE_KEY)?.[1];
}

function languageCode(languages: Edition['languages']): string | null {
    const code = languages?.[0] && keyCode(languages[0].key);
    return code ? isoLanguage(code) : null;
}

// Search results carry the year the book first came out, pooled across
// every edition.
async function getSearchDoc(isbn: string) {
    const parsed = SearchSchema.safeParse(
        await getJson(
            `/search.json?q=isbn:${isbn}&fields=first_publish_year&limit=1`
        )
    );
    return parsed.success ? (parsed.data.docs[0] ?? {}) : {};
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

/**
 * Everything about an edition beyond what identifies it. Open Library keeps
 * the description on the work more often than the edition, and
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

    const [editionAuthors, work, searchDoc] = await Promise.all([
        attempt(getAuthors(edition), editionCredits(edition)),
        attempt(getWork(edition), {}),
        attempt(getSearchDoc(isbn), {}),
    ]);
    // Some editions only list their authors on the work.
    const authors = editionAuthors.length
        ? editionAuthors
        : await attempt(
              authorNames((work.authors ?? []).map(({ author }) => author.key)),
              []
          );
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
        illustrators: creditsAs(edition, ILLUSTRATOR),
        translators: creditsAs(edition, TRANSLATOR),
        editionName: editionName(edition.edition_name),
        physicalFormat: edition.physical_format?.trim() || null,
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
/**
 * The year and, when a day is given, the full date of a release like
 * "September 3, 2019", "2019-09-03", "Sep 2019" or "2019".
 */
export function parseRelease(raw: string | undefined): {
    releaseYear: number | null;
    releaseDate: string | null;
} {
    const text = raw?.trim() ?? '';
    const year = text.match(/(?<!\d)(\d{4})(?!\d)/)?.[1];
    const releaseYear = year ? Number(year) : null;
    // A day is the end of an ISO date, or a one or two digit number outside
    // a year and month like "2019-09".
    const hasDay =
        /^\d{4}-\d{2}-\d{2}/.test(text) ||
        (!/^\d{4}-\d{2}$/.test(text) && /(^|\D)\d{1,2}(\D|$)/.test(text));
    const parsed = hasDay ? Date.parse(text) : Number.NaN;
    return {
        releaseYear,
        releaseDate: Number.isNaN(parsed)
            ? null
            : new Date(parsed).toISOString().slice(0, 10),
    };
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
            ...parseRelease(edition.publish_date),
            kind: bookKind(edition),
            series: rawSeries
                ? cleanSeriesName(rawSeries)
                : seriesFromTitle(edition.title),
            volume: parseVolume(edition.title, rawSeries),
            language: languageCode(edition.languages),
            coverUrl: coverId ? `${COVERS_URL}/b/id/${coverId}-L.jpg` : null,
            source: ExternalSource.OpenLibrary,
            sourceId: edition.key.replace('/books/', ''),
        },
        complete,
    };
}
