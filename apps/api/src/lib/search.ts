import { type Column, ilike, or, type SQL, sql } from '@analog/db';

import { containsPattern } from './pagination.js';

const MAX_TERMS = 8;
const NUMBER = /^\d+(\.\d+)?$/;

/** Splits a query into lowercase words, e.g. "Haikyu 19" → ["haikyu", "19"]. */
export function searchTerms(q: string): string[] {
    return q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
}

/** Drops bare numbers, for searching things that have no volume number. */
export function withoutNumbers(terms: string[]): string[] {
    const words = terms.filter((term) => !NUMBER.test(term));
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
    const perTerm = terms.map((term) =>
        or(
            ...columns.flatMap((column) => [
                ilike(column, containsPattern(term)),
                sql`${term} <% ${column}`,
            ]),
            position && NUMBER.test(term)
                ? sql`${position} = ${Number(term)}`
                : undefined
        )
    );
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
