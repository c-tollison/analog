import { and, desc, eq, isNull, schema, sql } from '@analog/db';
import {
    ExternalSource,
    languageName,
    MediaFormat,
    type SeriesChoiceSchema,
    SeriesKind,
} from '@analog/types';

import { findUploadedCover } from './covers.js';
import { filledFacts, filledLinks } from './details.js';
import { discoverableSeries } from './discovery.js';
import { isGoogleBooksCover, lookupGoogleBooksIsbn } from './google-books.js';
import { db, logger } from './init.js';
import {
    type BookDetails,
    type BookLookup,
    isLatin,
    lookupIsbn,
} from './open-library.js';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

type CatalogItem = typeof schema.catalogItem.$inferSelect;
type Series = typeof schema.series.$inferSelect;
type Edition = Omit<
    typeof schema.catalogItemIsbn.$inferSelect,
    'catalogItemId' | 'createdAt'
>;

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

export function readMetadata(item: Pick<CatalogItem, 'metadata'>): BookDetails {
    return BookMetadataSchema.parse(item.metadata);
}

/**
 * In a query grouped by series, the cover of the lowest volume in each
 * group, like the lowest one a shelf owns.
 */
export const lowestVolumeCover = sql<string | null>`(
    array_agg(${schema.catalogItem.coverUrl} order by ${schema.catalogItem.position} asc nulls last)
        filter (where ${schema.catalogItem.coverUrl} is not null)
)[1]`;

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

/**
 * A stored book as a lookup, showing the edition with this ISBN when it has
 * its own cover and publisher on file. The title is always the book's, the
 * one admins edit.
 */
export function toBookLookup(
    item: CatalogItem,
    series: Series | null,
    isbn: string,
    edition: Edition | null
): BookLookup {
    const meta = readMetadata(item);
    return {
        ...meta,
        isbn,
        title: item.title,
        publishers: edition?.publisher ? [edition.publisher] : meta.publishers,
        physicalFormat: edition?.format ?? meta.physicalFormat,
        releaseDate: item.releaseDate,
        kind: toBookKind(item.kind),
        series: series?.title ?? null,
        volume: item.position,
        language: edition?.language ?? null,
        coverUrl: edition?.coverUrl ?? item.coverUrl,
        source: item.externalSource ?? ExternalSource.OpenLibrary,
        sourceId: item.externalId ?? '',
    };
}

/** The item an ISBN belongs to, with that ISBN's own edition. */
export async function findBookByIsbn(isbn: string) {
    const found = await db().query.catalogItemIsbn.findFirst({
        where: eq(schema.catalogItemIsbn.isbn, isbn),
        with: {
            catalogItem: {
                with: { series: true },
            },
        },
    });
    if (!found) {
        return null;
    }
    const { catalogItem: item, catalogItemId, createdAt, ...edition } = found;
    return { ...item, edition };
}

// Who is picking a series. An admin editing from the dashboard can pick
// any series; everyone else only the ones they can find.
export type SeriesPicker = { userId: string; admin: boolean };

function pickableSeries({ userId, admin }: SeriesPicker) {
    return admin ? undefined : discoverableSeries(userId);
}

async function findSeriesByTitle(
    title: string,
    picker: SeriesPicker
): Promise<Series | null> {
    const found = await db().query.series.findFirst({
        where: and(
            sql`lower(${schema.series.title}) = lower(${title})`,
            pickableSeries(picker)
        ),
    });
    return found ?? null;
}

export async function suggestSeries(
    item: (CatalogItem & { series: Series | null }) | null,
    book: BookLookup,
    userId: string
): Promise<Series | null> {
    if (item?.series) {
        return item.series;
    }
    return book.series
        ? findSeriesByTitle(book.series, { userId, admin: false })
        : null;
}

const SERIES_MATCH_LIMIT = 3;
const SERIES_MATCH_THRESHOLD = 0.5;
export const VOLUME_TEXT =
    /[\s,:;]*(\b(vol(ume)?|v|book|part|no)\.?|#)\s*\d+(\.\d+)?\b|[\s,:;]+\d+(\.\d+)?\s*$/gi;

/**
 * Existing series whose title is close to a book's, for books with no
 * suggested series. "Neon Genesis Evangelion 3-in-1 Edition Vol. 1" finds
 * "Neon Genesis Evangelion 3-in-1 Edition", and "Bleach, Volume 21" finds
 * "Bleach Manga (English)". Checks both ways round, since either title can
 * carry words the other lacks.
 */
export async function findSimilarSeries(bookTitle: string, userId: string) {
    const title = bookTitle.replace(VOLUME_TEXT, '').trim() || bookTitle;
    const column = schema.series.title;
    const score = sql<number>`greatest(
        word_similarity(${column}, ${title}),
        word_similarity(${title}, ${column})
    )`;
    return db()
        .select({
            id: schema.series.id,
            title: column,
            kind: schema.series.kind,
        })
        .from(schema.series)
        .where(
            and(
                sql`${score} >= ${SERIES_MATCH_THRESHOLD}`,
                discoverableSeries(userId)
            )
        )
        .orderBy(desc(score), desc(sql`similarity(${column}, ${title})`))
        .limit(SERIES_MATCH_LIMIT);
}

type SeriesChoice = z.output<typeof SeriesChoiceSchema>;

async function resolveSeries(
    choice: SeriesChoice,
    kind: BookLookup['kind'],
    picker: SeriesPicker
): Promise<Series> {
    if ('id' in choice) {
        const found = await db().query.series.findFirst({
            where: and(eq(schema.series.id, choice.id), pickableSeries(picker)),
        });
        if (!found) {
            throw new HTTPException(404, { message: 'Series not found' });
        }
        return found;
    }

    const existing = await findSeriesByTitle(choice.title, picker);
    if (existing) {
        return existing;
    }
    const [created] = await db()
        .insert(schema.series)
        .values({ title: choice.title, kind, createdByUserId: picker.userId })
        .returning();
    if (!created) {
        throw new Error('Failed to create series');
    }
    return created;
}

/**
 * The series a book goes in, creating it from a title when needed. A new
 * series takes the book's kind, and only its creator can find it until an
 * admin verifies it.
 */
export function seriesForItem(
    choice: SeriesChoice,
    item: CatalogItem,
    picker: SeriesPicker
): Promise<Series> {
    return resolveSeries(choice, toBookKind(item.kind), picker);
}

/**
 * An item's kind once it's in a series. The series' kind wins, so all its
 * items match.
 */
export function kindInSeries(
    series: Pick<Series, 'kind'> | null,
    itemKind: SeriesKind | null
): SeriesKind | null {
    return series?.kind ?? itemKind;
}

export type Transaction = Parameters<
    Parameters<ReturnType<typeof db>['transaction']>[0]
>[0];

type Executor = Pick<Transaction, 'update'>;

/** Gives every item in a series the series' kind, after either one changes. */
export async function matchSeriesKind(
    seriesId: string,
    executor: Executor = db()
): Promise<void> {
    const { catalogItem, series } = schema;
    await executor
        .update(catalogItem)
        .set({
            kind: sql`(select ${series.kind} from ${series}
                where ${series.id} = ${seriesId})`,
            updatedAt: new Date(),
        })
        .where(eq(catalogItem.seriesId, seriesId));
}

/**
 * Sets a series' cover to its lowest volume's cover. Series linked
 * to an external source keep the cover that source provided.
 */
export async function refreshSeriesCover(seriesId: string): Promise<void> {
    const { series, catalogItem } = schema;
    await db()
        .update(series)
        .set({
            coverUrl: sql`(
                select ${catalogItem.coverUrl} from ${catalogItem}
                where ${catalogItem.seriesId} = ${seriesId}
                    and ${catalogItem.coverUrl} is not null
                order by ${catalogItem.position} asc nulls last,
                    ${catalogItem.releaseDate} asc nulls last
                limit 1
            )`,
            updatedAt: new Date(),
        })
        .where(
            and(eq(series.id, seriesId), sql`${series.externalSource} is null`)
        );
}

/**
 * Moves every item in one series into another, then deletes the first. The
 * other series keeps its own title, link and volume count.
 */
export async function mergeSeries(
    fromId: string,
    intoId: string
): Promise<void> {
    const { catalogItem, series } = schema;
    await db().transaction(async (tx) => {
        await tx
            .update(catalogItem)
            .set({ seriesId: intoId, updatedAt: new Date() })
            .where(eq(catalogItem.seriesId, fromId));
        await tx.delete(series).where(eq(series.id, fromId));
        await matchSeriesKind(intoId, tx);
    });
    await refreshSeriesCover(intoId);
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

// Some records name the book or its authors in Japanese. Take the backup's
// when it's in English.
function inEnglish(value: string | null, backup: string | null) {
    return value && !isLatin(value) && backup && isLatin(backup)
        ? backup
        : (value ?? backup);
}

function allInEnglish(values: string[], backup: string[]): string[] {
    const english = (names: string[]) =>
        names.length > 0 && names.every(isLatin);
    return !english(values) && english(backup)
        ? backup
        : either(values, backup);
}

/**
 * A book's data, with anything it's missing taken from a backup. Names in
 * English win over the book's own.
 */
function fillIn(book: BookLookup, backup: BookLookup): BookLookup {
    return {
        ...book,
        title: inEnglish(book.title, backup.title) ?? book.title,
        subtitle: inEnglish(book.subtitle, backup.subtitle),
        authors: allInEnglish(book.authors, backup.authors),
        publishers: either(book.publishers, backup.publishers),
        publishDate: book.publishDate ?? backup.publishDate,
        firstPublishYear: book.firstPublishYear ?? backup.firstPublishYear,
        pageCount: book.pageCount ?? backup.pageCount,
        description: book.description ?? backup.description,
        characters: either(book.characters, backup.characters),
        editionName: book.editionName ?? backup.editionName,
        physicalFormat: book.physicalFormat ?? backup.physicalFormat,
        languages: either(book.languages, backup.languages),
        language: book.language ?? backup.language,
        goodreadsId: book.goodreadsId ?? backup.goodreadsId,
        genres: either(book.genres, backup.genres),
        releaseDate: book.releaseDate ?? backup.releaseDate,
        kind: book.kind === SeriesKind.Book ? backup.kind : book.kind,
        series: inEnglish(book.series, backup.series),
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
export type Lookup = {
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

async function lookupGoogleBooks(isbn: string, googleId?: string) {
    const result = await settle(lookupGoogleBooksIsbn(isbn, googleId));
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
    // The book's Google id, when an admin picked it from a Google search.
    googleId?: string;
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
async function lookupSources(isbn: string, options: LookupOptions) {
    const { stored, refresh } = options;
    const openLibrary = options.openLibrary ? lookupOpenLibrary(isbn) : null;
    const google = options.google
        ? await lookupGoogleBooks(isbn, options.googleId)
        : null;
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

/**
 * Looks up an ISBN on the book sources. A cover an admin uploaded for it
 * wins over theirs.
 */
export async function lookupBook(isbn: string, options: LookupOptions) {
    const [lookup, uploaded] = await Promise.all([
        lookupSources(isbn, options),
        findUploadedCover(isbn),
    ]);
    if (!lookup || !uploaded) {
        return lookup;
    }
    const withCover = (found: Lookup): Lookup => ({
        ...found,
        book: { ...found.book, coverUrl: uploaded },
    });
    return {
        ...withCover(lookup),
        later: lookup.later?.then((found) => found && withCover(found)) ?? null,
    };
}

/**
 * Saves a lookup over a stored book and its ISBN's edition. Series and volume
 * aren't touched, and a book in a series keeps the series' kind. Verified
 * books aren't saved over.
 */
async function saveBook(itemId: string, lookup: Lookup) {
    const { book } = lookup;
    const { catalogItem, catalogItemIsbn, series } = schema;
    // By ISBN alone: a scan may have joined it to another item since.
    await db()
        .update(catalogItemIsbn)
        .set(isbnFacts(book))
        .where(eq(catalogItemIsbn.isbn, book.isbn));
    const [updated] = await db()
        .update(catalogItem)
        .set({
            kind: sql`coalesce(
                (select ${series.kind} from ${series}
                    where ${series.id} = ${catalogItem.seriesId}),
                ${book.kind}
            )`,
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
        .where(and(eq(catalogItem.id, itemId), isNull(catalogItem.verifiedAt)))
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
export async function saveLater(itemId: string, later: Promise<Lookup | null>) {
    try {
        const lookup = await later;
        if (lookup) {
            await saveBook(itemId, lookup);
        }
    } catch (error) {
        logger().warn({ error, itemId }, 'Saving late book lookup failed');
    }
}

/** What a book's own ISBN row says about its edition. */
export function isbnFacts(book: BookLookup) {
    return {
        title: book.title,
        coverUrl: book.coverUrl,
        publisher: book.publishers[0] ?? null,
        language: book.language,
        format: book.physicalFormat,
    };
}

// A new catalog item for a looked-up book.
function bookValues(lookup: Lookup, userId: string) {
    const { book } = lookup;
    return {
        format: MediaFormat.Book,
        kind: book.kind,
        title: book.title,
        externalSource: book.source,
        externalId: book.sourceId,
        coverUrl: book.coverUrl,
        releaseDate: book.releaseDate,
        metadata: { ...BookMetadataSchema.parse(book) },
        googleBooksFetchedAt: lookup.googleBooksFetchedAt,
        openLibraryFetchedAt: lookup.openLibraryFetchedAt,
        createdByUserId: userId,
    };
}

/**
 * Adds a catalog item for a looked-up book, then runs `claim` to give it its
 * ISBN. When the claim fails, the item is removed again and null comes back.
 */
export async function createItemClaimingIsbn(
    tx: Transaction,
    lookup: Lookup,
    userId: string,
    claim: (itemId: string) => Promise<boolean>
): Promise<string | null> {
    const { catalogItem } = schema;
    const [created] = await tx
        .insert(catalogItem)
        .values(bookValues(lookup, userId))
        .returning({ id: catalogItem.id });
    if (!created) {
        return null;
    }
    if (!(await claim(created.id))) {
        await tx.delete(catalogItem).where(eq(catalogItem.id, created.id));
        return null;
    }
    return created.id;
}

/**
 * Saves a looked-up book as a new catalog item, with its ISBN as the main
 * one. Returns null when another item already has the ISBN, since two scans
 * can race.
 */
async function insertBook(
    isbn: string,
    lookup: Lookup,
    userId: string
): Promise<string | null> {
    const { catalogItemIsbn } = schema;
    return db().transaction((tx) =>
        createItemClaimingIsbn(tx, lookup, userId, async (itemId) => {
            const [owned] = await tx
                .insert(catalogItemIsbn)
                .values({
                    isbn,
                    catalogItemId: itemId,
                    main: true,
                    ...isbnFacts(lookup.book),
                })
                // Another scan of the same ISBN got here first.
                .onConflictDoNothing()
                .returning({ isbn: catalogItemIsbn.isbn });
            return !!owned;
        })
    );
}

/**
 * Returns the catalog item for an ISBN, creating it from the book sources if
 * we haven't seen it. `fetched` is the source's data when it was just
 * fetched, which still has its series name and volume guesses.
 */
export async function findOrCreateBook(
    isbn: string,
    userId: string,
    googleId?: string
) {
    const existing = await findBookByIsbn(isbn);
    if (existing) {
        return { item: existing, fetched: null };
    }

    const lookup = await lookupBook(isbn, {
        stored: null,
        google: true,
        googleId,
        openLibrary: true,
        refresh: false,
    });
    if (!lookup) {
        throw new HTTPException(404, {
            message: `No book found for ISBN ${isbn}`,
        });
    }
    const { book, later } = lookup;
    const created = await insertBook(isbn, lookup, userId);
    if (created && later) {
        void saveLater(created, later);
    }
    const item = await findBookByIsbn(isbn);
    if (!item) {
        throw new Error(`Catalog item for ${isbn} missing after insert`);
    }
    return { item, fetched: book };
}

/**
 * Looks up a stored book again. What the lookup finds wins, and anything it
 * comes back without keeps its stored value. Series and volume stay as the
 * user set them, and verified books are only edited by hand. With
 * `onlyMissing`, only sources that haven't answered for this book are asked.
 */
export async function refreshBook(itemId: string, onlyMissing = false) {
    const item = await db().query.catalogItem.findFirst({
        where: eq(schema.catalogItem.id, itemId),
        with: {
            series: true,
            isbns: { where: (row, { eq }) => eq(row.main, true) },
        },
    });
    if (!item) {
        throw new HTTPException(404, { message: 'Item not found' });
    }
    if (item.format !== MediaFormat.Book) {
        throw new HTTPException(400, {
            message: "Refreshing isn't supported for this media yet",
        });
    }
    const [main] = item.isbns;
    if (!main) {
        throw new HTTPException(400, {
            message: 'This book has no ISBN to look up',
        });
    }
    if (item.verifiedAt) {
        throw new HTTPException(400, {
            message: 'Verified items are only edited by hand',
        });
    }
    const lookup = await lookupBook(main.isbn, {
        stored: toBookLookup(item, item.series, main.isbn, main),
        google: !onlyMissing || !item.googleBooksFetchedAt,
        openLibrary: !onlyMissing || !item.openLibraryFetchedAt,
        refresh: true,
    });
    if (!lookup) {
        throw new HTTPException(404, {
            message: `No book found for ISBN ${main.isbn}`,
        });
    }
    if (lookup.later) {
        void saveLater(item.id, lookup.later);
    }
    return saveBook(item.id, lookup);
}

/**
 * The book's details for its page. Facts about the edition come from the one
 * the page is for. Dates, pages and edition names are only on file for the
 * item's main ISBN, so other editions leave them out.
 */
export function bookDetails(item: CatalogItem, edition: Edition | null) {
    const meta = readMetadata(item);
    const isMain = !edition || edition.main;
    const mainOnly = <T>(value: T) => (isMain ? value : null);

    const facts = [
        { label: 'Genres', value: meta.genres.join(', ') },
        { label: 'First published', value: meta.firstPublishYear?.toString() },
        { label: 'This edition', value: mainOnly(meta.publishDate) },
        {
            label: 'Publisher',
            value: edition?.publisher ?? mainOnly(meta.publishers.join(', ')),
        },
        { label: 'Edition', value: mainOnly(meta.editionName) },
        {
            label: 'Format',
            value: edition?.format ?? mainOnly(meta.physicalFormat),
        },
        {
            label: 'Language',
            value:
                languageName(edition?.language) ??
                mainOnly(meta.languages.join(', ')),
        },
        { label: 'Pages', value: mainOnly(meta.pageCount?.toString()) },
        { label: 'ISBN', value: edition?.isbn },
    ];

    return {
        subtitle: meta.subtitle,
        creators: meta.authors,
        description: meta.description,
        facts: filledFacts(facts),
    };
}

type LinkFields = Pick<
    CatalogItem,
    'format' | 'metadata' | 'externalSource' | 'externalId'
>;

/**
 * Where else a book can be looked at: Goodreads and the source it came from.
 * Only admin pages show these.
 */
function bookLinks(item: LinkFields) {
    const goodreadsId = readMetadata(item).goodreadsId;
    const sourceId = item.externalId;
    return filledLinks([
        {
            label: 'Goodreads',
            url: goodreadsId
                ? `https://www.goodreads.com/book/show/${goodreadsId}`
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
    ]);
}

/** An item's outside links, whatever kind of media it is. */
export function itemLinks(item: LinkFields) {
    return item.format === MediaFormat.Book ? bookLinks(item) : [];
}

type ItemDetails = ReturnType<typeof bookDetails>;

const NO_DETAILS: ItemDetails = {
    subtitle: null,
    creators: [],
    description: null,
    facts: [],
};

/** What an item's page shows about it, whatever kind of media it is. */
export function itemDetails(
    item: CatalogItem,
    edition: Edition | null
): ItemDetails {
    return item.format === MediaFormat.Book
        ? bookDetails(item, edition)
        : NO_DETAILS;
}
