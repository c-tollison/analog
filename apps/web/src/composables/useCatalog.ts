import { api, unwrap } from '@/lib/api';

import { useQueryClient } from '@tanstack/vue-query';

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
