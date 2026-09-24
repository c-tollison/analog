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
    lookupEditionDetails,
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

// Once Google has answered, how much longer to wait for Open Library before
// going with Google's data alone. Open Library is often slow.
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

function waitAtMost<T>(promise: Promise<Settled<T>>, ms: number) {
    const timeout = new Promise<Settled<T>>((resolve) =>
        setTimeout(() => resolve({ value: null, error: null }), ms)
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

/** Google's data, with anything it's missing taken from Open Library. */
function fillIn(google: BookLookup, openLibrary: BookLookup): BookLookup {
    return {
        ...google,
        subtitle: google.subtitle ?? openLibrary.subtitle,
        authors: either(google.authors, openLibrary.authors),
        publishers: either(google.publishers, openLibrary.publishers),
        publishDate: google.publishDate ?? openLibrary.publishDate,
        firstPublishYear:
            google.firstPublishYear ?? openLibrary.firstPublishYear,
        pageCount: google.pageCount ?? openLibrary.pageCount,
        description: google.description ?? openLibrary.description,
        characters: either(google.characters, openLibrary.characters),
        editionName: google.editionName ?? openLibrary.editionName,
        physicalFormat: google.physicalFormat ?? openLibrary.physicalFormat,
        languages: either(google.languages, openLibrary.languages),
        goodreadsId: google.goodreadsId ?? openLibrary.goodreadsId,
        genres: either(google.genres, openLibrary.genres),
        releaseDate: google.releaseDate ?? openLibrary.releaseDate,
        kind: google.kind === SeriesKind.Book ? openLibrary.kind : google.kind,
        series: google.series ?? openLibrary.series,
        volume: google.volume ?? openLibrary.volume,
        coverUrl: sharperCover(google.coverUrl, openLibrary.coverUrl),
    };
}

/**
 * Looks up an ISBN on Google Books and Open Library at the same time. Google's
 * data wins, and Open Library fills in whatever Google is missing. Open
 * Library's data is used alone when Google has no match or fails.
 */
async function lookupBook(
    isbn: string,
    openLibraryWaitMs = OPEN_LIBRARY_WAIT_MS
) {
    const openLibrary = settle(lookupIsbn(isbn));
    const google = await settle(lookupGoogleBooksIsbn(isbn));
    if (google.error) {
        logger().warn(
            { error: google.error, isbn },
            'Google Books lookup failed'
        );
    }

    if (!google.value) {
        const fallback = await openLibrary;
        const error = fallback.error ?? (fallback.value ? null : google.error);
        if (error) {
            throw error;
        }
        return fallback.value;
    }

    const extra = await waitAtMost(openLibrary, openLibraryWaitMs);
    if (extra.error) {
        logger().warn(
            { error: extra.error, isbn },
            'Open Library lookup failed'
        );
    }
    return extra.value
        ? { ...google.value, book: fillIn(google.value.book, extra.value.book) }
        : google.value;
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

    const lookup = await lookupBook(isbn);
    if (!lookup) {
        throw new HTTPException(404, {
            message: `No book found for ISBN ${isbn}`,
        });
    }
    const { book, complete } = lookup;
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
            // Left empty when part of the lookup failed, so the item page
            // fills in the rest later.
            detailsFetchedAt: complete ? new Date() : null,
            createdByUserId: userId,
        })
        .onConflictDoNothing({ target: schema.catalogItem.barcode });
    const item = await findBookByIsbn(isbn);
    if (!item) {
        throw new Error(`Catalog item for ${isbn} missing after insert`);
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
 * user set them.
 */
export async function refreshBook(itemId: string) {
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
    const lookup = await lookupBook(item.barcode, REFRESH_OPEN_LIBRARY_WAIT_MS);
    if (!lookup) {
        throw new HTTPException(404, {
            message: `No book found for ISBN ${item.barcode}`,
        });
    }

    const book = fillIn(lookup.book, toBookLookup(item, item.series));
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
            // Set even when part of the lookup failed. The background refresh
            // would replace the merged details with Open Library's alone.
            detailsFetchedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(schema.catalogItem.id, item.id))
        .returning({
            id: schema.catalogItem.id,
            title: schema.catalogItem.title,
            coverUrl: schema.catalogItem.coverUrl,
        });
    if (item.seriesId) {
        await refreshSeriesCover(item.seriesId);
    }
    return updated;
}

const refreshing = new Set<string>();

/**
 * Pulls a book's details from Open Library in the background. Details are
 * marked fetched once every part comes back, or Open Library says the
 * edition is gone. Anything else is retried on a later visit.
 */
async function refreshBookDetails(item: CatalogItem): Promise<void> {
    if (
        item.externalSource !== ExternalSource.OpenLibrary ||
        !item.externalId ||
        !item.barcode ||
        refreshing.has(item.id)
    ) {
        return;
    }
    refreshing.add(item.id);
    try {
        const result = await lookupEditionDetails(
            item.externalId,
            item.barcode
        );
        await db()
            .update(schema.catalogItem)
            .set({
                ...(result ? { metadata: { ...result.details } } : {}),
                detailsFetchedAt:
                    !result || result.complete ? new Date() : null,
            })
            .where(eq(schema.catalogItem.id, item.id));
    } catch (error) {
        logger().warn(
            { error, itemId: item.id },
            'Book details refresh failed'
        );
    } finally {
        refreshing.delete(item.id);
    }
}

/**
 * The book's details for its page. Books missing details get them in the
 * background, so the page never waits on Open Library; they show up on the
 * next visit.
 */
export function bookDetails(item: CatalogItem) {
    const meta = readMetadata(item);
    if (!item.detailsFetchedAt) {
        void refreshBookDetails(item);
    }

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
