import type { PageQuery } from '@analog/types';

/**
 * Runs a query for one page. `fetchRows` gets limit + 1 so we can tell if
 * another page exists without a separate count query.
 */
export async function paginate<T>(
    { limit, offset }: PageQuery,
    fetchRows: (limit: number, offset: number) => Promise<T[]>
) {
    const rows = await fetchRows(limit + 1, offset);
    return {
        items: rows.slice(0, limit),
        nextOffset: rows.length > limit ? offset + limit : null,
    };
}

/**
 * Builds an ILIKE pattern that matches `term` literally: anywhere in the
 * value, or only at the start when `anywhere` is false.
 */
export function likePattern(
    term: string,
    { anywhere = true }: { anywhere?: boolean } = {}
): string {
    const escaped = term.replace(/[\\%_]/g, '\\$&');
    return anywhere ? `%${escaped}%` : `${escaped}%`;
}
