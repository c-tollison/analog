import { useTitle } from '@vueuse/core';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { useRoute } from 'vue-router';

/**
 * Sets the browser tab title. Shows the route's `meta.title` until `title`
 * has a value, like a collection name that is still loading.
 */
export function usePageTitle(title?: MaybeRefOrGetter<string | undefined>) {
    const route = useRoute();
    useTitle(() => toValue(title) ?? route.meta.title, {
        titleTemplate: (page) => (page ? `${page} - Analog` : 'Analog'),
        // The next page has already set its title by the time this unmounts.
        restoreOnUnmount: false,
    });
}
