import type { InferResponseType } from '@analog/api/client';
import { type ApiClient, api, unwrap } from '@/lib/api';

import { useQuery } from '@tanstack/vue-query';

export const GENRES_KEY = ['genres'] as const;

export type Genre = InferResponseType<ApiClient['genres']['$get'], 200>[number];

/** Every genre, for pickers. The list rarely changes, so it loads once. */
export function useGenres() {
    return useQuery({
        queryKey: GENRES_KEY,
        queryFn: async () => unwrap(await api.genres.$get()),
        staleTime: Number.POSITIVE_INFINITY,
    });
}
