import type { CollectionItemDetail } from '@/composables/useCollections';
import { languageName } from '@/lib/languages';

type EditionFacts = Pick<
    CollectionItemDetail['editions'][number],
    'isbn' | 'language' | 'format' | 'publisher'
>;

/** One line about an edition, like "9781974701056 · English · Paperback". */
export function editionSummary(edition: EditionFacts): string {
    return [
        edition.isbn,
        languageName(edition.language),
        edition.format,
        edition.publisher,
    ]
        .filter(Boolean)
        .join(' · ');
}
