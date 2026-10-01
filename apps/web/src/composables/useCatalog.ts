import type { InferResponseType } from '@analog/api/client';
import { type ApiClient, api, unwrap } from '@/lib/api';

import { ADMIN_KEY } from './useAdmin';
import { COLLECTIONS_KEY } from './useCollections';
import { usePaginatedList } from './usePaginatedList';
import { SERIES_KEY } from './useSeries';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';

export type IsbnLookup = InferResponseType<
    ApiClient['catalog']['isbn'][':isbn']['$get'],
    200
>;

export type GoogleResult = InferResponseType<
    ApiClient['admin']['google']['$get'],
    200
>['items'][number];

export const CATALOG_KEY = ['catalog'] as const;

/**
 * How long typing must pause before Google is searched. Longer than other
 * searches, since each one counts against the daily limit.
 */
export const GOOGLE_SEARCH_DELAY_MS = 1000;

// Kept apart from CATALOG_KEY, and skipped by admin edits, so adding a book
// doesn't search Google again.
export const GOOGLE_KEY = ['google-books'] as const;

/**
 * Searches Google Books by title for admins, a page at a time, optionally in
 * one language. Each search counts against a daily limit, so pages are kept
 * for the session and failures aren't retried.
 */
export function useAdminGoogleSearch(
    term: MaybeRefOrGetter<string>,
    lang: MaybeRefOrGetter<string | null>,
    enabled: MaybeRefOrGetter<boolean>
) {
    const q = () => toValue(term).toLowerCase();
    return usePaginatedList(
        () => [...GOOGLE_KEY, 'admin', q(), toValue(lang)],
        async (offset) => {
            const language = toValue(lang);
            return unwrap(
                await api.admin.google.$get({
                    query: {
                        q: q(),
                        offset,
                        ...(language ? { lang: language } : {}),
                    },
                })
            );
        },
        { enabled: () => !!toValue(term) && toValue(enabled), once: true }
    );
}

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
 * lookups, series, collection lists and admin pages, so all of them refresh.
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
                [COLLECTIONS_KEY, CATALOG_KEY, SERIES_KEY, ADMIN_KEY].map(
                    (queryKey) => queryClient.invalidateQueries({ queryKey })
                )
            ),
    });
}
