import type { Directive } from 'vue';

// Keeps browsers and password managers from offering autofill on
// inputs that aren't for accounts, like a collection name or search.
const attributes = {
    autocomplete: 'off',
    'data-1p-ignore': '',
    'data-lpignore': 'true',
    'data-bwignore': '',
    'data-form-type': 'other',
};

export const vNoAutofill: Directive<HTMLElement> = {
    mounted(el) {
        for (const [name, value] of Object.entries(attributes)) {
            el.setAttribute(name, value);
        }
    },
};
