import type { InferResponseType } from '@analog/api/client';
import { type ApiClient, api, unwrap } from '@/lib/api';

import { COLLECTIONS_KEY } from './useCollections';
import { SERIES_KEY } from './useSeries';
import { useMutation, useQueryClient } from '@tanstack/vue-query';

export type IsbnLookup = InferResponseType<
    ApiClient['catalog']['isbn'][':isbn']['$get'],
    200
>;

export const CATALOG_KEY = ['catalog'] as const;

/**
 * Looks up an ISBN on demand (e.g. from a scan), through the cache so
 * scanning the same book again is served from memory.
 */
export function useIsbnLookup() {
    const queryClient = useQueryClient();

    return (isbn: string) =>
        queryClient.fetchQuery({
            queryKey: [...CATALOG_KEY, 'isbn', isbn],
            queryFn: async () =>
                unwrap(
                    await api.catalog.isbn[':isbn'].$get({ param: { isbn } })
                ),
        });
}

/**
 * Looks up a book again to fill in missing details. Its cover shows in
 * lookups, series and collection lists, so all three refresh.
 */
export function useRefreshBook() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ catalogItemId }: { catalogItemId: string }) =>
            unwrap(
                await api.catalog.items[':id'].refresh.$post({
                    param: { id: catalogItemId },
                })
            ),
        onSuccess: () =>
            Promise.all(
                [COLLECTIONS_KEY, CATALOG_KEY, SERIES_KEY].map((queryKey) =>
                    queryClient.invalidateQueries({ queryKey })
                )
            ),
    });
}
