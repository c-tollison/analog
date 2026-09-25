import { and, desc, eq, schema, sql } from '@analog/db';
import {
    ExternalSource,
    MediaFormat,
    type SeriesChoiceSchema,
    SeriesKind,
} from '@analog/types';

import { filledFacts, filledLinks } from './details.js';
import { isGoogleBooksCover, lookupGoogleBooksIsbn } from './google-books.js';
import { db, logger } from './init.js';
import {
    type BookDetails,
    type BookLookup,
    lookupIsbn,
} from './open-library.js';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

type CatalogItem = typeof schema.catalogItem.$inferSelect;
type Series = typeof schema.series.$inferSelect;

// What's stored in a book's `metadata`. Older rows may be missing fields.
const BookMetadataSchema = z.object({
    subtitle: z.string().nullable().catch(null),
    authors: z.array(z.string()).catch([]),
    publishers: z.array(z.string()).catch([]),
    publishDate: z.string().nullable().catch(null),
    firstPublishYear: z.number().nullable().catch(null),
    pageCount: z.number().nullable().catch(null),
    description: z.string().nullable().catch(null),
    characters: z.array(z.string()).catch([]),
    editionName: z.string().nullable().catch(null),
    physicalFormat: z.string().nullable().catch(null),
    languages: z.array(z.string()).catch([]),
    goodreadsId: z.string().nullable().catch(null),
    genres: z.array(z.string()).catch([]),
}) satisfies z.ZodType<BookDetails>;

function readMetadata(item: CatalogItem): BookDetails {
    return BookMetadataSchema.parse(item.metadata);
}

export const seriesColumns = {
    id: schema.series.id,
    title: schema.series.title,
    kind: schema.series.kind,
    coverUrl: schema.series.coverUrl,
};

function toBookKind(kind: SeriesKind | null | undefined): BookLookup['kind'] {
    return kind === SeriesKind.Manga || kind === SeriesKind.LightNovel
        ? kind
        : SeriesKind.Book;
}

export function toBookLookup(
    item: CatalogItem,
    series: Series | null
): BookLookup {
    return {
        isbn: item.barcode ?? '',
        title: item.title,
        ...readMetadata(item),
        releaseDate: item.releaseDate,
        kind: toBookKind(item.kind),
        series: series?.title ?? null,
        volume: item.position,
        coverUrl: item.coverUrl,
        source: item.externalSource ?? ExternalSource.OpenLibrary,
        sourceId: item.externalId ?? '',
    };
}

export async function findBookByIsbn(isbn: string) {
    const item = await db().query.catalogItem.findFirst({
        where: and(
            eq(schema.catalogItem.barcode, isbn),
            eq(schema.catalogItem.format, MediaFormat.Book)
        ),
        with: { series: true },
    });
    return item ?? null;
}

async function findSeriesByTitle(title: string): Promise<Series | null> {
    const found = await db().query.series.findFirst({
        where: (series, { sql }) =>
            sql`lower(${series.title}) = lower(${title})`,
    });
    return found ?? null;
}

export async function suggestSeries(
    item: (CatalogItem & { series: Series | null }) | null,
    book: BookLookup
): Promise<Series | null> {
    if (item?.series) {
        return item.series;
    }
    return book.series ? findSeriesByTitle(book.series) : null;
}

const SERIES_MATCH_LIMIT = 3;
const SERIES_MATCH_THRESHOLD = 0.5;
const VOLUME_TEXT =
    /[\s,:;]*(\b(vol(ume)?|v|book|part|no)\.?|#)\s*\d+(\.\d+)?\b|[\s,:;]+\d+(\.\d+)?\s*$/gi;

/**
 * Existing series whose title is close to a book's, for books with no
 * suggested series. "Neon Genesis Evangelion 3-in-1 Edition Vol. 1" finds
 * "Neon Genesis Evangelion 3-in-1 Edition", and "Bleach, Volume 21" finds
 * "Bleach Manga (English)". Checks both ways round, since either title can
 * carry words the other lacks.
 */
export async function findSimilarSeries(bookTitle: string) {
    const title = bookTitle.replace(VOLUME_TEXT, '').trim() || bookTitle;
    const column = schema.series.title;
    const score = sql<number>`greatest(
        word_similarity(${column}, ${title}),
        word_similarity(${title}, ${column})
    )`;
    return db()
        .select({ id: schema.series.id, title: column })
        .from(schema.series)
        .where(sql`${score} >= ${SERIES_MATCH_THRESHOLD}`)
        .orderBy(desc(score), desc(sql`similarity(${column}, ${title})`))
        .limit(SERIES_MATCH_LIMIT);
}

type SeriesChoice = z.output<typeof SeriesChoiceSchema>;

async function resolveSeries(
    choice: SeriesChoice,
    kind: BookLookup['kind']
): Promise<Series> {
    if ('id' in choice) {
        const found = await db().query.series.findFirst({
            where: eq(schema.series.id, choice.id),
        });
        if (!found) {
            throw new HTTPException(404, { message: 'Series not found' });
        }
        return found;
    }

    const existing = await findSeriesByTitle(choice.title);
    if (existing) {
        return existing;
    }
    const [created] = await db()
        .insert(schema.series)
        .values({ title: choice.title, kind })
        .returning();
    if (!created) {
        throw new Error('Failed to create series');
    }
    return created;
}

/**
 * Sets a series' cover to its earliest-released item's cover. Series linked
 * to an external source keep the cover that source provided.
 */
async function refreshSeriesCover(seriesId: string): Promise<void> {
    const { series, catalogItem } = schema;
    await db()
        .update(series)
        .set({
            coverUrl: sql`(
                select ${catalogItem.coverUrl} from ${catalogItem}
                where ${catalogItem.seriesId} = ${seriesId}
                    and ${catalogItem.coverUrl} is not null
                order by ${catalogItem.releaseDate} asc nulls last,
                    ${catalogItem.position} asc nulls last
                limit 1
            )`,
            updatedAt: new Date(),
        })
        .where(
            and(eq(series.id, seriesId), sql`${series.externalSource} is null`)
        );
}

// Once Google has answered, how much longer a scan waits for Open Library
// before going with Google's data alone. Open Library is often slow, so its
// part is saved when it arrives.
const OPEN_LIBRARY_WAIT_MS = 2_000;
// A refresh is asked for, so it can wait for Open Library's sharper cover.
const REFRESH_OPEN_LIBRARY_WAIT_MS = 20_000;

type Settled<T> = { value: T | null; error: unknown };

async function settle<T>(promise: Promise<T | null>): Promise<Settled<T>> {
    try {
        return { value: await promise, error: null };
    } catch (error) {
        return { value: null, error };
    }
}

// Null when the time runs out first.
function waitAtMost<T>(promise: Promise<T>, ms: number): Promise<T | null> {
    const timeout = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), ms)
    );
    return Promise.race([promise, timeout]);
}

function either<T>(values: T[], backup: T[]): T[] {
    return values.length ? values : backup;
}

// Google only has small thumbnails for most print books, so any other cover
// is sharper.
function sharperCover(first: string | null, second: string | null) {
    return (
        [first, second].find((url) => url && !isGoogleBooksCover(url)) ??
        first ??
        second
    );
}

/** A book's data, with anything it's missing taken from a backup. */
function fillIn(book: BookLookup, backup: BookLookup): BookLookup {
    return {
        ...book,
        subtitle: book.subtitle ?? backup.subtitle,
        authors: either(book.authors, backup.authors),
        publishers: either(book.publishers, backup.publishers),
        publishDate: book.publishDate ?? backup.publishDate,
        firstPublishYear: book.firstPublishYear ?? backup.firstPublishYear,
        pageCount: book.pageCount ?? backup.pageCount,
        description: book.description ?? backup.description,
        characters: either(book.characters, backup.characters),
        editionName: book.editionName ?? backup.editionName,
        physicalFormat: book.physicalFormat ?? backup.physicalFormat,
        languages: either(book.languages, backup.languages),
        goodreadsId: book.goodreadsId ?? backup.goodreadsId,
        genres: either(book.genres, backup.genres),
        releaseDate: book.releaseDate ?? backup.releaseDate,
        kind: book.kind === SeriesKind.Book ? backup.kind : book.kind,
        series: book.series ?? backup.series,
        volume: book.volume ?? backup.volume,
        coverUrl: sharperCover(book.coverUrl, backup.coverUrl),
    };
}

// Earlier books win, and later ones fill in what they're missing.
function merge(books: (BookLookup | null)[]): BookLookup | null {
    return books.reduce<BookLookup | null>(
        (merged, book) =>
            merged && book ? fillIn(merged, book) : (merged ?? book),
        null
    );
}

type OpenLibraryResult = NonNullable<Awaited<ReturnType<typeof lookupIsbn>>>;

// Each source's time is set when it answered, whether or not it had the book.
type Lookup = {
    book: BookLookup;
    googleBooksFetchedAt: Date | null;
    openLibraryFetchedAt: Date | null;
};

/**
 * Google Books' data wins over Open Library's, and fresh data wins over
 * stored data from the same source. A source that's null wasn't asked or
 * hasn't answered yet.
 */
function combine(
    stored: BookLookup | null,
    google: Settled<BookLookup> | null,
    openLibrary: Settled<OpenLibraryResult> | null
): Lookup | null {
    const fresh = google?.value ?? null;
    const extra = openLibrary?.value?.book ?? null;
    const book = merge(
        stored?.source === ExternalSource.GoogleBooks
            ? [fresh, stored, extra]
            : [fresh, extra, stored]
    );
    if (!book) {
        return null;
    }
    const now = new Date();
    const openLibraryDone =
        openLibrary &&
        !openLibrary.error &&
        openLibrary.value?.complete !== false;
    return {
        book,
        googleBooksFetchedAt: google && !google.error ? now : null,
        openLibraryFetchedAt: openLibraryDone ? now : null,
    };
}

async function lookupGoogleBooks(isbn: string) {
    const result = await settle(lookupGoogleBooksIsbn(isbn));
    if (result.error) {
        logger().warn(
            { error: result.error, isbn },
            'Google Books lookup failed'
        );
    }
    return result;
}

async function lookupOpenLibrary(isbn: string) {
    const result = await settle(lookupIsbn(isbn));
    if (result.error) {
        logger().warn(
            { error: result.error, isbn },
            'Open Library lookup failed'
        );
    }
    return result;
}

type LookupOptions = {
    // The book as it's stored, when looking it up again.
    stored: BookLookup | null;
    google: boolean;
    openLibrary: boolean;
    refresh: boolean;
};

/**
 * Looks up an ISBN on Google Books and Open Library at the same time, or on
 * just the sources asked for. Open Library fills in whatever Google is
 * missing, like a sharper cover. When Google fails during a scan, Open
 * Library's data is used alone. A refresh fails instead, so it can be tried
 * again later.
 *
 * When Open Library is too slow, Google's data comes back without it, and
 * `later` has the full lookup to save once Open Library answers.
 */
async function lookupBook(isbn: string, options: LookupOptions) {
    const { stored, refresh } = options;
    const openLibrary = options.openLibrary ? lookupOpenLibrary(isbn) : null;
    const google = options.google ? await lookupGoogleBooks(isbn) : null;
    if (google?.error && refresh) {
        throw google.error;
    }

    if (!google?.value) {
        const extra = openLibrary ? await openLibrary : null;
        const lookup = combine(stored, google, extra);
        const error = extra?.error ?? google?.error;
        if (!lookup && error) {
            throw error;
        }
        return lookup && { ...lookup, later: null };
    }

    if (!openLibrary) {
        const lookup = combine(stored, google, null);
        return lookup && { ...lookup, later: null };
    }
    const later = openLibrary.then((extra) => combine(stored, google, extra));
    const done = await waitAtMost(
        later,
        refresh ? REFRESH_OPEN_LIBRARY_WAIT_MS : OPEN_LIBRARY_WAIT_MS
    );
    if (done) {
        return { ...done, later: null };
    }
    const lookup = combine(stored, google, null);
    return lookup && { ...lookup, later };
}

/** Saves a lookup over a stored book. Series and volume aren't touched. */
async function saveBook(itemId: string, lookup: Lookup) {
    const { book } = lookup;
    const [updated] = await db()
        .update(schema.catalogItem)
        .set({
            kind: book.kind,
            title: book.title,
            externalSource: book.source,
            externalId: book.sourceId,
            coverUrl: book.coverUrl,
            releaseDate: book.releaseDate,
            metadata: { ...BookMetadataSchema.parse(book) },
            // A source that didn't answer keeps its last time.
            googleBooksFetchedAt: lookup.googleBooksFetchedAt ?? undefined,
            openLibraryFetchedAt: lookup.openLibraryFetchedAt ?? undefined,
            updatedAt: new Date(),
        })
        .where(eq(schema.catalogItem.id, itemId))
        .returning({
            id: schema.catalogItem.id,
            title: schema.catalogItem.title,
            coverUrl: schema.catalogItem.coverUrl,
            seriesId: schema.catalogItem.seriesId,
        });
    if (!updated) {
        return null;
    }
    const { seriesId, ...saved } = updated;
    if (seriesId) {
        await refreshSeriesCover(seriesId);
    }
    return saved;
}

// Saves a lookup that was still waiting on Open Library.
async function saveLater(itemId: string, later: Promise<Lookup | null>) {
    try {
        const lookup = await later;
        if (lookup) {
            await saveBook(itemId, lookup);
        }
    } catch (error) {
        logger().warn({ error, itemId }, 'Saving late book lookup failed');
    }
}

/**
 * Returns the catalog item for an ISBN, creating it from the book sources if
 * we haven't seen it. `fetched` is the source's data when it was just
 * fetched, which still has its series name and volume guesses.
 */
export async function findOrCreateBook(isbn: string, userId: string) {
    const existing = await findBookByIsbn(isbn);
    if (existing) {
        return { item: existing, fetched: null };
    }

    const lookup = await lookupBook(isbn, {
        stored: null,
        google: true,
        openLibrary: true,
        refresh: false,
    });
    if (!lookup) {
        throw new HTTPException(404, {
            message: `No book found for ISBN ${isbn}`,
        });
    }
    const { book, later } = lookup;
    const metadata = BookMetadataSchema.parse(book);
    await db()
        .insert(schema.catalogItem)
        .values({
            format: MediaFormat.Book,
            kind: book.kind,
            title: book.title,
            barcode: isbn,
            externalSource: book.source,
            externalId: book.sourceId,
            coverUrl: book.coverUrl,
            releaseDate: book.releaseDate,
            metadata: { ...metadata },
            googleBooksFetchedAt: lookup.googleBooksFetchedAt,
            openLibraryFetchedAt: lookup.openLibraryFetchedAt,
            createdByUserId: userId,
        })
        .onConflictDoNothing({ target: schema.catalogItem.barcode });
    const item = await findBookByIsbn(isbn);
    if (!item) {
        throw new Error(`Catalog item for ${isbn} missing after insert`);
    }
    if (later) {
        void saveLater(item.id, later);
    }
    return { item, fetched: book };
}

/**
 * Sets the series and volume on the catalog item for an ISBN. They come from
 * the user and overwrite what's stored, since Open Library's series data is
 * unreliable.
 */
export async function upsertBook(
    isbn: string,
    seriesChoice: SeriesChoice | null,
    volume: number | null,
    userId: string
): Promise<CatalogItem> {
    const { item } = await findOrCreateBook(isbn, userId);
    const kind = toBookKind(item.kind);

    const series = seriesChoice
        ? await resolveSeries(seriesChoice, kind)
        : null;

    const [updated] = await db()
        .update(schema.catalogItem)
        .set({
            seriesId: series?.id ?? null,
            position: volume,
            updatedAt: new Date(),
        })
        .where(eq(schema.catalogItem.id, item.id))
        .returning();
    if (!updated) {
        throw new Error(`Catalog item ${item.id} missing on update`);
    }

    const affected = new Set([item.seriesId, updated.seriesId]);
    await Promise.all(
        [...affected]
            .filter((seriesId): seriesId is string => !!seriesId)
            .map(refreshSeriesCover)
    );
    return updated;
}

/**
 * Looks up a stored book again. What the lookup finds wins, and anything it
 * comes back without keeps its stored value. Series and volume stay as the
 * user set them. With `onlyMissing`, only sources that haven't answered for
 * this book are asked.
 */
export async function refreshBook(itemId: string, onlyMissing = false) {
    const item = await db().query.catalogItem.findFirst({
        where: eq(schema.catalogItem.id, itemId),
        with: { series: true },
    });
    if (!item) {
        throw new HTTPException(404, { message: 'Item not found' });
    }
    if (item.format !== MediaFormat.Book || !item.barcode) {
        throw new HTTPException(400, {
            message: 'Only books with an ISBN can be refreshed',
        });
    }
    const lookup = await lookupBook(item.barcode, {
        stored: toBookLookup(item, item.series),
        google: !onlyMissing || !item.googleBooksFetchedAt,
        openLibrary: !onlyMissing || !item.openLibraryFetchedAt,
        refresh: true,
    });
    if (!lookup) {
        throw new HTTPException(404, {
            message: `No book found for ISBN ${item.barcode}`,
        });
    }
    if (lookup.later) {
        void saveLater(item.id, lookup.later);
    }
    return saveBook(item.id, lookup);
}

/** The book's details for its page, from what's stored. */
export function bookDetails(item: CatalogItem) {
    const meta = readMetadata(item);

    const facts = [
        { label: 'Genres', value: meta.genres.join(', ') },
        { label: 'First published', value: meta.firstPublishYear?.toString() },
        { label: 'This edition', value: meta.publishDate },
        { label: 'Publisher', value: meta.publishers.join(', ') },
        { label: 'Edition', value: meta.editionName },
        { label: 'Format', value: meta.physicalFormat },
        { label: 'Language', value: meta.languages.join(', ') },
        { label: 'Pages', value: meta.pageCount?.toString() },
        { label: 'ISBN', value: item.barcode },
    ];
    const sourceId = item.externalId;
    const links = [
        {
            label: 'Goodreads',
            url: meta.goodreadsId
                ? `https://www.goodreads.com/book/show/${meta.goodreadsId}`
                : null,
        },
        {
            label: 'Google Books',
            url:
                sourceId && item.externalSource === ExternalSource.GoogleBooks
                    ? `https://books.google.com/books?id=${sourceId}`
                    : null,
        },
        {
            label: 'Open Library',
            url:
                sourceId && item.externalSource === ExternalSource.OpenLibrary
                    ? `https://openlibrary.org/books/${sourceId}`
                    : null,
        },
    ];

    return {
        subtitle: meta.subtitle,
        creators: meta.authors,
        description: meta.description,
        facts: filledFacts(facts),
        links: filledLinks(links),
    };
}

type ItemDetails = ReturnType<typeof bookDetails>;

const NO_DETAILS: ItemDetails = {
    subtitle: null,
    creators: [],
    description: null,
    facts: [],
    links: [],
};

/** What an item's page shows about it, whatever kind of media it is. */
export function itemDetails(item: CatalogItem): ItemDetails {
    return item.format === MediaFormat.Book ? bookDetails(item) : NO_DETAILS;
}
