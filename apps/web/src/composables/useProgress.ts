import type { ReviewSchema, SetProgressStatusSchema } from '@analog/types';
import { api, unwrap } from '@/lib/api';

import { COLLECTIONS_KEY } from './useCollections';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { z } from 'zod';

// Status and reviews belong to the person, not a collection, so a change
// refreshes every collection's counts.

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
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
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
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
    });
}
