import { refDebounced } from '@vueuse/core';
import { computed, type Ref } from 'vue';

const SEARCH_DEBOUNCE_MS = 400;

/**
 * Debounced, trimmed search text for query keys. Clearing the box applies
 * immediately; `isTyping` is true until the debounced term catches up, so
 * lists can show a spinner instead of flashing "no results".
 */
export function useSearchTerm(input: Ref<string>) {
    const trimmed = computed(() => input.value.trim());
    const debounced = refDebounced(trimmed, SEARCH_DEBOUNCE_MS);
    const term = computed(() => (trimmed.value ? debounced.value : ''));
    const isTyping = computed(() => trimmed.value !== term.value);
    return { trimmed, term, isTyping };
}
