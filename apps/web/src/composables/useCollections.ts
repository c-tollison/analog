import {
    type AddBookSchema,
    type AddCatalogItemsSchema,
    type CreateCollectionSchema,
    MAX_PAGE_SIZE,
} from '@analog/types';
import { api, unwrap } from '@/lib/api';

import { CATALOG_KEY } from './useCatalog';
import {
    type PaginatedListOptions,
    usePaginatedList,
} from './usePaginatedList';
import { SERIES_KEY } from './useSeries';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import type { z } from 'zod';

export const COLLECTIONS_KEY = ['collections'] as const;

// Everything about one collection lives under its key, so deleting it can
// drop the lot.
const collectionKey = (id: string) => [...COLLECTIONS_KEY, 'detail', id];

/** The collections the user belongs to. */
export function useCollections(limit?: number) {
    return usePaginatedList(
        () => [...COLLECTIONS_KEY, 'list', limit],
        async (offset) =>
            unwrap(
                await api.collections.$get({
                    query: {
                        offset,
                        ...(limit ? { limit: String(limit) } : {}),
                    },
                })
            )
    );
}

/** Items across every collection matching `q`; nothing loads while it's empty. */
export function useCollectionSearch(
    q: MaybeRefOrGetter<string>,
    options: PaginatedListOptions = {}
) {
    return usePaginatedList(
        () => [...COLLECTIONS_KEY, 'search', toValue(q)],
        async (offset) =>
            unwrap(
                await api.collections.search.$get({
                    query: { q: toValue(q), offset },
                })
            ),
        { enabled: () => toValue(q) !== '', ...options }
    );
}

export function useCollection(id: MaybeRefOrGetter<string>) {
    return useQuery({
        queryKey: () => collectionKey(toValue(id)),
        queryFn: async () =>
            unwrap(
                await api.collections[':id'].$get({
                    param: { id: toValue(id) },
                })
            ),
    });
}

/** A collection's series and one-shots, optionally filtered by `q`. */
export function useCollectionEntries(
    id: MaybeRefOrGetter<string>,
    q: MaybeRefOrGetter<string>,
    options: PaginatedListOptions = {}
) {
    return usePaginatedList(
        () => [...collectionKey(toValue(id)), 'entries', toValue(q)],
        async (offset) =>
            unwrap(
                await api.collections[':id'].entries.$get({
                    param: { id: toValue(id) },
                    query: { offset, ...(toValue(q) ? { q: toValue(q) } : {}) },
                })
            ),
        options
    );
}

/** One series as it stands in a collection. */
export function useCollectionSeries(
    id: MaybeRefOrGetter<string>,
    seriesId: MaybeRefOrGetter<string>
) {
    return useQuery({
        queryKey: () => [
            ...collectionKey(toValue(id)),
            'series',
            toValue(seriesId),
        ],
        queryFn: async () =>
            unwrap(
                await api.collections[':id'].series[':seriesId'].$get({
                    param: { id: toValue(id), seriesId: toValue(seriesId) },
                })
            ),
    });
}

/** The volumes of a series the collection owns. */
export function useCollectionSeriesItems(
    id: MaybeRefOrGetter<string>,
    seriesId: MaybeRefOrGetter<string>
) {
    return usePaginatedList(
        () => [
            ...collectionKey(toValue(id)),
            'series',
            toValue(seriesId),
            'items',
        ],
        async (offset) =>
            unwrap(
                await api.collections[':id'].series[':seriesId'].items.$get({
                    param: { id: toValue(id), seriesId: toValue(seriesId) },
                    query: { offset },
                })
            )
    );
}

/**
 * Catalog items whose title matches `q`, or every item in `seriesId`,
 * flagged with whether the collection has them. Nothing loads until one of
 * the two is set.
 */
export function useCatalogItems(
    id: MaybeRefOrGetter<string>,
    q: MaybeRefOrGetter<string>,
    seriesId: MaybeRefOrGetter<string | undefined>,
    options: PaginatedListOptions = {}
) {
    return usePaginatedList(
        () => [
            ...collectionKey(toValue(id)),
            'catalog',
            toValue(q),
            toValue(seriesId),
        ],
        async (offset) => {
            const search = toValue(q);
            const series = toValue(seriesId);
            return unwrap(
                await api.collections[':id'].catalog.$get({
                    param: { id: toValue(id) },
                    query: {
                        limit: String(MAX_PAGE_SIZE),
                        offset,
                        ...(search ? { q: search } : {}),
                        ...(series ? { seriesId: series } : {}),
                    },
                })
            );
        },
        {
            enabled: () => toValue(q) !== '' || toValue(seriesId) !== undefined,
            ...options,
        }
    );
}

export function useCreateCollection() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (json: z.output<typeof CreateCollectionSchema>) =>
            unwrap(await api.collections.$post({ json })),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
    });
}

/**
 * Dropping the collection's queries before invalidating keeps the page that
 * is still showing it from refetching a 404 before the caller navigates away.
 */
export function useDeleteCollection() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) =>
            unwrap(await api.collections[':id'].$delete({ param: { id } })),
        onSuccess: (_data, id) => {
            queryClient.removeQueries({ queryKey: collectionKey(id) });
            return queryClient.invalidateQueries({
                queryKey: COLLECTIONS_KEY,
            });
        },
    });
}

/** Add catalog items to a collection by id. */
export function useAddCollectionItems() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            collectionId,
            ...json
        }: z.output<typeof AddCatalogItemsSchema> & { collectionId: string }) =>
            unwrap(
                await api.collections[':id'].items.$post({
                    param: { id: collectionId },
                    json,
                })
            ),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
    });
}

export function useRemoveCollectionItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: { collectionId: string; itemId: string }) =>
            unwrap(
                await api.collections[':id'].items[':itemId'].$delete({
                    param: { id: input.collectionId, itemId: input.itemId },
                })
            ),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
    });
}

/**
 * Add a scanned book. A new series or catalog item shows up in lookups,
 * series searches and collection lists, so all three refresh.
 */
export function useAddBook() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            collectionId,
            ...json
        }: z.output<typeof AddBookSchema> & { collectionId: string }) =>
            unwrap(
                await api.collections[':id'].books.$post({
                    param: { id: collectionId },
                    json,
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
