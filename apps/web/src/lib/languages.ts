import { languageName } from '@analog/types';

/** Languages a book search can be narrowed to, by ISO 639-1 code. */
export const SEARCH_LANGUAGES = [
    'en',
    'ja',
    'es',
    'fr',
    'de',
    'it',
    'pt',
    'ko',
    'zh',
].map((code) => ({ code, name: languageName(code) ?? code }));
