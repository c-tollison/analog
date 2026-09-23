import { normalizeIsbn } from '@analog/types';

/**
 * Pulls an ISBN out of a scanned barcode. Books often carry a 2- or 5-digit
 * price add-on (e.g. "51300") which can't be used in the search
 */
export function isbnFromBarcode(raw: string): string | null {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 15 || digits.length === 18) {
        return normalizeIsbn(digits.slice(0, 13));
    }
    return digits.length === 13 ? normalizeIsbn(digits) : null;
}
