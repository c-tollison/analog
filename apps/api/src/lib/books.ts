import { and, desc, eq, schema, sql } from '@analog/db';
import {
    ExternalSource,
    MediaFormat,
    type SeriesChoiceSchema,
    SeriesKind,
} from '@analog/types';

import { db } from './init.js';
import { type BookLookup, lookupIsbn } from './open-library.js';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

type CatalogItem = typeof schema.catalogItem.$inferSelect;
type Series = typeof schema.series.$inferSelect;

const BookMetadataSchema = z.object({
    subtitle: z.string().nullable(),
    authors: z.array(z.string()),
    publishers: z.array(z.string()),
    publishDate: z.string().nullable(),
    pageCount: z.number().nullable(),
});

type BookMetadata = z.infer<typeof BookMetadataSchema>;

export const seriesColumns = {
    id: schema.series.id,
    title: schema.series.title,
    kind: schema.series.kind,
    coverUrl: schema.series.coverUrl,
};

function toBookKind(kind: SeriesKind | null | undefined): BookLookup['kind'] {
    return kind === SeriesKind.Manga ? SeriesKind.Manga : SeriesKind.Book;
}

export function toBookLookup(
    item: CatalogItem,
    series: Series | null
): BookLookup {
    const parsed = BookMetadataSchema.partial().safeParse(item.metadata);
    const meta = parsed.success ? parsed.data : {};
    return {
        isbn: item.barcode ?? '',
        title: item.title,
        subtitle: meta.subtitle ?? null,
        authors: meta.authors ?? [],
        publishers: meta.publishers ?? [],
        publishDate: meta.publishDate ?? null,
        releaseDate: item.releaseDate,
        pageCount: meta.pageCount ?? null,
        kind: toBookKind(item.kind),
        series: series?.title ?? null,
        volume: item.position,
        coverUrl: item.coverUrl,
        source: ExternalSource.OpenLibrary,
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

/**
 * Returns the catalog item for an ISBN, creating it from Open Library if we
 * haven't seen it. `fetched` is Open Library's data when it was just fetched,
 * which still has its series name and volume guesses.
 */
export async function findOrCreateBook(isbn: string, userId: string) {
    const existing = await findBookByIsbn(isbn);
    if (existing) {
        return { item: existing, fetched: null };
    }

    const book = await lookupIsbn(isbn);
    if (!book) {
        throw new HTTPException(404, {
            message: `No book found for ISBN ${isbn}`,
        });
    }
    const metadata: BookMetadata = {
        subtitle: book.subtitle,
        authors: book.authors,
        publishers: book.publishers,
        publishDate: book.publishDate,
        pageCount: book.pageCount,
    };
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
