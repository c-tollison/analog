const names = new Intl.DisplayNames(['en'], { type: 'language' });

/** An ISO 639 code, like "en", from any language code, like "eng". */
export function isoLanguage(code: string): string | null {
    try {
        return Intl.getCanonicalLocales(code)[0] ?? null;
    } catch {
        return null;
    }
}

/** A language's English name from any language code, like "German" for "ger". */
export function languageName(code: string | null | undefined): string | null {
    if (!code) {
        return null;
    }
    try {
        const name = names.of(code);
        return name && name !== code ? name : null;
    } catch {
        return null;
    }
}
