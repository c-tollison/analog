import { z } from 'zod';

function isbn10CheckDigit(first9: string): string {
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += Number(first9[i]) * (10 - i);
    }
    const check = (11 - (sum % 11)) % 11;
    return check === 10 ? 'X' : String(check);
}

function isbn13CheckDigit(first12: string): string {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
    }
    return String((10 - (sum % 10)) % 10);
}

/**
 * Normalizes an ISBN-10 or ISBN-13 (hyphens/spaces allowed) to ISBN-13.
 * Returns null if the input isn't a valid ISBN.
 */
export function normalizeIsbn(input: string): string | null {
    const raw = input.replace(/[\s-]/g, '').toUpperCase();

    if (/^\d{9}[\dX]$/.test(raw)) {
        if (isbn10CheckDigit(raw.slice(0, 9)) !== raw[9]) {
            return null;
        }
        const first12 = `978${raw.slice(0, 9)}`;
        return first12 + isbn13CheckDigit(first12);
    }

    if (/^97[89]\d{10}$/.test(raw)) {
        return isbn13CheckDigit(raw.slice(0, 12)) === raw[12] ? raw : null;
    }

    return null;
}

export const IsbnSchema = z.string().transform((value, ctx) => {
    const isbn = normalizeIsbn(value);
    if (!isbn) {
        ctx.addIssue({ code: 'custom', message: 'Enter a valid ISBN' });
        return z.NEVER;
    }
    return isbn;
});
