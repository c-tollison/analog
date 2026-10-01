import { languageName } from '@analog/types';
import type { ItemEdition } from '@/composables/useItems';

export type EditionRow = Pick<
    ItemEdition,
    'isbn' | 'title' | 'coverUrl' | 'language' | 'format' | 'publisher'
>;

/** One line about an edition, like "9781974701056 · English · Paperback". */
export function editionSummary(edition: EditionRow): string {
    return [
        edition.isbn,
        languageName(edition.language),
        edition.format,
        edition.publisher,
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
