import type { QueryKey } from '@tanstack/vue-query';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, reactive, toValue } from 'vue';

interface Page {
    items: unknown[];
    nextOffset: number | null;
}

export interface PaginatedListOptions {
    enabled?: MaybeRefOrGetter<boolean>;
    pending?: MaybeRefOrGetter<boolean>;
}

export interface PaginatedList<T> {
    items: T[];
    isLoading: boolean;
    isLoadingMore: boolean;
    error: string | null;
    hasMore: boolean;
    loadMore(): void;
}

/**
 * An offset-paginated API list backed by TanStack's infinite query, for the
 * list composables to build on. While a new key loads the previous items
 * stay visible. `fetchPage` must only read values that are in the key.
 *
 *     return usePaginatedList(
 *         () => [...COLLECTIONS_KEY, 'list'],
 *         async (offset) => unwrap(await api.collections.$get({ query: { offset } }))
 *     );
 */
export function usePaginatedList<P extends Page>(
    queryKey: () => QueryKey,
    fetchPage: (offset: string) => Promise<P>,
    { enabled = true, pending = false }: PaginatedListOptions = {}
): PaginatedList<P['items'][number]> {
    const query = useInfiniteQuery({
        queryKey: computed(queryKey),
        queryFn: ({ pageParam }) => fetchPage(String(pageParam)),
        initialPageParam: 0,
        getNextPageParam: (last: P) => last.nextOffset ?? undefined,
        enabled: () => toValue(enabled),
        placeholderData: keepPreviousData,
    });

    return reactive({
        items: computed(() =>
            toValue(enabled)
                ? (query.data.value?.pages.flatMap((page) => page.items) ?? [])
                : []
        ),
        isLoading: computed(
            () =>
                toValue(pending) ||
                (toValue(enabled) &&
                    query.isFetching.value &&
                    !query.isFetchingNextPage.value)
        ),
        isLoadingMore: query.isFetchingNextPage,
        error: computed(() => query.error.value?.message ?? null),
        hasMore: query.hasNextPage,
        loadMore() {
            if (!query.isFetching.value && query.hasNextPage.value) {
                void query.fetchNextPage();
            }
        },
    }) as PaginatedList<P['items'][number]>;
}
