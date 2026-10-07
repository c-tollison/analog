import { EDITION_FORMAT_LABELS, languageName } from '@analog/types';
import type { ItemEdition } from '@/composables/useItems';
import { creditLines } from '@/lib/credits';
import { formatDate } from '@/lib/dates';

export type EditionRow = Pick<
    ItemEdition,
    | 'isbn'
    | 'title'
    | 'editionName'
    | 'coverUrl'
    | 'language'
    | 'format'
    | 'publisher'
    | 'imprintOf'
    | 'releaseYear'
    | 'releaseDate'
    | 'pageCount'
    | 'credits'
>;

// The full date when it's known, or just the year.
function editionDate(edition: EditionRow): string | null {
    // Read as local time, so the day doesn't shift back a day.
    return edition.releaseDate
        ? formatDate(`${edition.releaseDate}T00:00:00`)
        : (edition.releaseYear?.toString() ?? null);
}

/**
 * One line about an edition, like "9781974701056 · Fullmetal Edition ·
 * English · Hardcover · Viz Media · 2019 · 192 pages".
 */
export function editionSummary(edition: EditionRow): string {
    return [
        edition.isbn,
        edition.editionName,
        languageName(edition.language),
        edition.format && EDITION_FORMAT_LABELS[edition.format],
        edition.publisher &&
            (edition.imprintOf
                ? `${edition.publisher} (${edition.imprintOf})`
                : edition.publisher),
        editionDate(edition),
        edition.pageCount && `${edition.pageCount} pages`,
    ]
        .filter(Boolean)
        .join(' · ');
}

// A mutation whose variables name an ISBN, like adding or removing one.
type IsbnMutation = {
    isPending: { readonly value: boolean };
    variables: { readonly value: { isbn: string } | undefined };
};

/** Whether a mutation is busy with this ISBN, to spin only its row's button. */
export function isPendingFor(mutation: IsbnMutation, isbn: string): boolean {
    return mutation.isPending.value && mutation.variables.value?.isbn === isbn;
}

/** Who worked on this edition, like "Translated by A · Narrated by B". */
export function editionCredits(edition: EditionRow): string {
    return creditLines(edition.credits)
        .map((line) => line.text)
        .join(' · ');
}
