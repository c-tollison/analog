import type { ReviewSchema, SetProgressStatusSchema } from '@analog/types';
import { api, unwrap } from '@/lib/api';

import { COLLECTIONS_KEY } from './useCollections';
import { ITEMS_KEY } from './useItems';
import { SERIES_KEY } from './useSeries';
import {
    type QueryClient,
    useMutation,
    useQueryClient,
} from '@tanstack/vue-query';
import type { z } from 'zod';

// Status and reviews belong to the person, not a collection, so a change
// refreshes every collection's counts and every item and series page.
function refreshProgress(queryClient: QueryClient) {
    return Promise.all(
        [COLLECTIONS_KEY, ITEMS_KEY, SERIES_KEY].map((queryKey) =>
            queryClient.invalidateQueries({ queryKey })
        )
    );
}

export function useSetProgressStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            catalogItemId,
            ...json
        }: z.output<typeof SetProgressStatusSchema> & {
            catalogItemId: string;
        }) =>
            unwrap(
                await api.catalog.items[':id'].status.$put({
                    param: { id: catalogItemId },
                    json,
                })
            ),
        onSuccess: () => refreshProgress(queryClient),
    });
}

export function useSaveReview() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            catalogItemId,
            ...json
        }: z.output<typeof ReviewSchema> & { catalogItemId: string }) =>
            unwrap(
                await api.catalog.items[':id'].review.$put({
                    param: { id: catalogItemId },
                    json,
                })
            ),
        onSuccess: () => refreshProgress(queryClient),
    });
}
