const names = new Intl.DisplayNames(['en'], { type: 'language' });

/** A language's English name from its code, like "Japanese" for "ja". */
export function languageName(code: string | null): string | null {
    if (!code) return null;
    try {
        return names.of(code) ?? code;
    } catch {
        return code;
    }
}
