import type { SeriesVolumeFilter, SetVolumeCountSchema } from '@analog/types';
import { api, unwrap } from '@/lib/api';

import { ADMIN_KEY } from './useAdmin';
import { COLLECTIONS_KEY } from './useCollections';
import {
    type PaginatedListOptions,
    pageLimit,
    usePaginatedList,
} from './usePaginatedList';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import type { z } from 'zod';

export const SERIES_KEY = ['series'] as const;

/**
 * Series whose titles match `q`; nothing loads while it's empty. Members only
 * find verified series and their own. `admin` searches every series, for the
 * admin dashboard.
 */
export function useSeriesSearch(
    q: MaybeRefOrGetter<string>,
    {
        limit,
        admin = false,
        ...options
    }: PaginatedListOptions & {
        limit?: MaybeRefOrGetter<number | undefined>;
        admin?: boolean;
    } = {}
) {
    return usePaginatedList(
        () => [...SERIES_KEY, 'search', toValue(q), toValue(limit), admin],
        async (offset) => {
            const query = {
                q: toValue(q),
                offset,
                ...pageLimit(limit),
            };
            return unwrap(
                admin
                    ? await api.admin.series.search.$get({ query })
                    : await api.series.$get({ query })
            );
        },
        { enabled: () => toValue(q) !== '', ...options }
    );
}

function shelfQuery(shelfId: MaybeRefOrGetter<string | null>) {
    const shelf = toValue(shelfId);
    return shelf ? { shelf } : {};
}

/**
 * A series' page, with your own counts. With a shelf, owning means on that
 * shelf.
 */
export function useSeriesPage(
    id: MaybeRefOrGetter<string>,
    shelfId: MaybeRefOrGetter<string | null>
) {
    return useQuery({
        queryKey: () => [...SERIES_KEY, 'page', toValue(id), toValue(shelfId)],
        queryFn: async () =>
            unwrap(
                await api.series[':id'].$get({
                    param: { id: toValue(id) },
                    query: shelfQuery(shelfId),
                })
            ),
    });
}

/**
 * A series' volumes you can see, with your status and ownership: the ones
 * you own, the ones you don't, or all of them. With a shelf, owning means
 * on that shelf.
 */
export function useSeriesVolumes(
    id: MaybeRefOrGetter<string>,
    show: MaybeRefOrGetter<SeriesVolumeFilter>,
    shelfId: MaybeRefOrGetter<string | null>
) {
    return usePaginatedList(
        () => [
            ...SERIES_KEY,
            'page',
            toValue(id),
            toValue(shelfId),
            'items',
            toValue(show),
        ],
        async (offset) =>
            unwrap(
                await api.series[':id'].items.$get({
                    param: { id: toValue(id) },
                    query: {
                        offset,
                        show: toValue(show),
                        ...shelfQuery(shelfId),
                    },
                })
            )
    );
}

// Series pages live under collection and admin keys, so all refresh.
function useInvalidateSeries() {
    const queryClient = useQueryClient();
    return () =>
        Promise.all(
            [COLLECTIONS_KEY, SERIES_KEY, ADMIN_KEY].map((queryKey) =>
                queryClient.invalidateQueries({ queryKey })
            )
        );
}

/** Sets how many volumes a series has in total. */
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
