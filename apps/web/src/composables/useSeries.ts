import { api, unwrap } from '@/lib/api';

import {
    type PaginatedListOptions,
    usePaginatedList,
} from './usePaginatedList';
import { type MaybeRefOrGetter, toValue } from 'vue';

export const SERIES_KEY = ['series'] as const;

/** Series in the shared catalog matching `q`; nothing loads while it's empty. */
export function useSeriesSearch(
    q: MaybeRefOrGetter<string>,
    { limit, ...options }: PaginatedListOptions & { limit?: number } = {}
) {
    return usePaginatedList(
        () => [...SERIES_KEY, 'search', toValue(q), limit],
        async (offset) =>
            unwrap(
                await api.series.$get({
                    query: {
                        q: toValue(q),
                        offset,
                        ...(limit ? { limit: String(limit) } : {}),
                    },
                })
            ),
        { enabled: () => toValue(q) !== '', ...options }
    );
}
