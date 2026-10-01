import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { useRoute, useRouter } from 'vue-router';

/**
 * A choice like a tab or sort that lives in the URL, so going back to the
 * page lands on the same one. Anything not in `values` reads as `fallback`.
 */
export function useQueryParam<T extends string>(
    key: string,
    values: readonly T[],
    fallback: MaybeRefOrGetter<T>
) {
    const route = useRoute();
    const router = useRouter();

    return computed({
        get: (): T =>
            values.find((value) => value === route.query[key]) ??
            toValue(fallback),
        set: (value: T) => {
            router.replace({ query: { ...route.query, [key]: value } });
        },
    });
}
