import {
    and,
    asc,
    type Column,
    desc,
    eq,
    ilike,
    inArray,
    or,
    type SQL,
    schema,
    sql,
} from '@analog/db';
import type { PageQuery } from '@analog/types';

import { seriesColumns } from './books.js';
import { db } from './init.js';
import { likePattern, paginate } from './pagination.js';

const MAX_TERMS = 8;
const NUMBER = /^\d+(\.\d+)?$/;

/** Splits a query into lowercase words, e.g. "Haikyu 19" → ["haikyu", "19"]. */
export function searchTerms(q: string): string[] {
    return q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
}

/** The term as a volume number, when it's a bare number like "19". */
export function termNumber(term: string): number | null {
    return NUMBER.test(term) ? Number(term) : null;
}

/**
 * True when `term` is a substring of the column or a close fuzzy match to a
 * word in it (pg_trgm `<%`, so typos like "haikyuu" still hit "Haikyu!!").
 * Both can use the column's trigram index.
 */
export function matchesTerm(term: string, column: Column): SQL {
    return sql`(${ilike(column, likePattern(term))} or ${term} <% ${column})`;
}

/** Drops bare numbers, for searching things that have no volume number. */
export function withoutNumbers(terms: string[]): string[] {
    const words = terms.filter((term) => termNumber(term) === null);
    return words.length ? words : terms;
}

interface MatchOptions {
    columns: Column[];
    position?: Column;
}

/**
 * True when every term matches: as a substring of one of the columns, as a
 * close fuzzy match to a word in one (pg_trgm `<%`, so typos like "haikyuu"
 * still hit "Haikyu!!"), or as a number equal to `position`.
 */
export function matchesAllTerms(
    terms: string[],
    { columns, position }: MatchOptions
): SQL | undefined {
    if (!terms.length) {
        return undefined;
    }
    const perTerm = terms.map((term) => {
        const number = termNumber(term);
        return or(
            ...columns.map((column) => matchesTerm(term, column)),
            position && number !== null
                ? sql`${position} = ${number}`
                : undefined
        );
    });
    return sql.join(
        perTerm.map((clause) => sql`(${clause})`),
        sql` and `
    );
}

/** Relevance for ordering: how closely the whole query matches a column. */
export function relevance(q: string, columns: Column[]): SQL<number> {
    const scores = columns.map(
        (column) => sql`coalesce(word_similarity(${q}, ${column}), 0)`
    );
    return sql<number>`greatest(${sql.join(scores, sql`, `)})`;
}

/**
 * Catalog items whose own title or series title matches every term, or whose
 * volume is a number term. Each title is looked up through its own trigram
 * index and the ids combined. One condition across both tables would make
 * Postgres check every row.
 */
export function catalogItemsMatching(terms: string[]): SQL | undefined {
    if (!terms.length) {
        return undefined;
    }
    const { catalogItem, series } = schema;
    return and(
        ...terms.map((term) => {
            const byTitle = db()
                .select({ id: catalogItem.id })
                .from(catalogItem)
                .where(matchesTerm(term, catalogItem.title));
            const bySeries = db()
                .select({ id: catalogItem.id })
                .from(catalogItem)
                .innerJoin(series, eq(catalogItem.seriesId, series.id))
                .where(matchesTerm(term, series.title));
            const ids = inArray(catalogItem.id, byTitle.unionAll(bySeries));
            const number = termNumber(term);
            return number === null
                ? ids
                : or(eq(catalogItem.position, number), ids);
        })
    );
}

/**
 * A page of series whose titles match `q`, closest first, limited by
 * `where`. Numbers in `q` are ignored, since series titles rarely have them.
 */
export function searchSeries(
    page: PageQuery,
    q: string | undefined,
    where: SQL | undefined
) {
    const title = schema.series.title;
    const terms = withoutNumbers(searchTerms(q ?? ''));
    return paginate(page, (limit, offset) =>
        db()
            .select(seriesColumns)
            .from(schema.series)
            .where(and(matchesAllTerms(terms, { columns: [title] }), where))
            .orderBy(
                ...(terms.length
                    ? [desc(relevance(terms.join(' '), [title]))]
                    : []),
                sql`lower(${title})`,
                asc(schema.series.id)
            )
            .limit(limit)
            .offset(offset)
    );
}
