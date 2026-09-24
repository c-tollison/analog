import type { InferResponseType } from '@analog/api/client';
import type {
    DetailsSource,
    LinkDetailsSourceSchema,
    SetVolumeCountSchema,
} from '@analog/types';
import { type ApiClient, api, unwrap } from '@/lib/api';

import { COLLECTIONS_KEY } from './useCollections';
import {
    type PaginatedListOptions,
    usePaginatedList,
} from './usePaginatedList';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import type { z } from 'zod';

export const SERIES_KEY = ['series'] as const;

export type DetailsSearchResult = InferResponseType<
    ApiClient['series']['details-source']['search']['$get'],
    200
>[number];

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

/** Entries in a details source matching `q`; nothing loads while it's empty. */
export function useDetailsSearch(
    source: MaybeRefOrGetter<DetailsSource>,
    q: MaybeRefOrGetter<string>
) {
    return useQuery({
        queryKey: () => [
            ...SERIES_KEY,
            'details-search',
            toValue(source),
            toValue(q),
        ],
        queryFn: async () =>
            unwrap(
                await api.series['details-source'].search.$get({
                    query: { source: toValue(source), q: toValue(q) },
                })
            ),
        enabled: () => toValue(q) !== '',
    });
}

// Series pages live under collection keys, so both refresh.
function useInvalidateSeries() {
    const queryClient = useQueryClient();
    return () =>
        Promise.all(
            [COLLECTIONS_KEY, SERIES_KEY].map((queryKey) =>
                queryClient.invalidateQueries({ queryKey })
            )
        );
}

export function useLinkDetailsSource() {
    const invalidate = useInvalidateSeries();

    return useMutation({
        mutationFn: async ({
            seriesId,
            ...json
        }: z.output<typeof LinkDetailsSourceSchema> & { seriesId: string }) =>
            unwrap(
                await api.series[':id']['details-source'].$put({
                    param: { id: seriesId },
                    json,
                })
            ),
        onSuccess: invalidate,
    });
}

export function useUnlinkDetailsSource() {
    const invalidate = useInvalidateSeries();

    return useMutation({
        mutationFn: async (seriesId: string) =>
            unwrap(
                await api.series[':id']['details-source'].$delete({
                    param: { id: seriesId },
                })
            ),
        onSuccess: invalidate,
    });
}

/** Sets how many volumes a series has in total, linked or not. */
export function useSetVolumeCount() {
    const invalidate = useInvalidateSeries();

    return useMutation({
        mutationFn: async ({
            seriesId,
            ...json
        }: z.output<typeof SetVolumeCountSchema> & { seriesId: string }) =>
            unwrap(
                await api.series[':id']['volume-count'].$put({
                    param: { id: seriesId },
                    json,
                })
            ),
        onSuccess: invalidate,
    });
}
