import type { InferResponseType } from '@analog/api/client';
import type { IsbnSchema } from '@analog/types';
import { type ApiClient, api, unwrap } from '@/lib/api';

import { COLLECTIONS_KEY } from './useCollections';
import {
    type PaginatedListOptions,
    pageLimit,
    usePaginatedList,
} from './usePaginatedList';
import { SERIES_KEY } from './useSeries';
import {
    type QueryClient,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import type { z } from 'zod';

export const ITEMS_KEY = ['items'] as const;

const itemKey = (id: string) => [...ITEMS_KEY, id];

export type ItemPage = InferResponseType<
    ApiClient['items'][':id']['$get'],
    200
>;

export type ItemEdition = InferResponseType<
    ApiClient['items'][':id']['editions']['$get'],
    200
>['items'][number];

export type BookSearchResult = InferResponseType<
    ApiClient['items']['search']['$get'],
    200
>['items'][number];

/** Books matching `q`, closest first; nothing loads while it's empty. */
export function useBookSearch(
    q: MaybeRefOrGetter<string>,
    {
        limit,
        ...options
    }: PaginatedListOptions & {
        limit?: MaybeRefOrGetter<number | undefined>;
    } = {}
) {
    return usePaginatedList(
        () => [...ITEMS_KEY, 'search', toValue(q), toValue(limit)],
        async (offset) =>
            unwrap(
                await api.items.search.$get({
                    query: {
                        q: toValue(q),
                        offset,
                        ...pageLimit(limit),
                    },
                })
            ),
        { enabled: () => toValue(q) !== '', ...options }
    );
}

/** An item's page: its details, your status and the shelves that hold it. */
export function useItem(id: MaybeRefOrGetter<string>) {
    return useQuery({
        queryKey: () => itemKey(toValue(id)),
        queryFn: async () =>
            unwrap(await api.items[':id'].$get({ param: { id: toValue(id) } })),
    });
}

/**
 * An item's editions, a page at a time. With `collectionId`, the ones that
 * shelf owns are marked and come first. `q` matches an ISBN, publisher or
 * edition title.
 */
export function useItemEditions(
    id: MaybeRefOrGetter<string>,
    {
        collectionId,
        q,
        ...options
    }: PaginatedListOptions & {
        collectionId?: MaybeRefOrGetter<string | null>;
        q?: MaybeRefOrGetter<string>;
    } = {}
) {
    return usePaginatedList(
        () => [
            ...itemKey(toValue(id)),
            'editions',
            toValue(collectionId),
            toValue(q),
        ],
        async (offset) => {
            const shelf = toValue(collectionId);
            const search = toValue(q);
            return unwrap(
                await api.items[':id'].editions.$get({
                    param: { id: toValue(id) },
                    query: {
                        offset,
                        ...(shelf ? { collectionId: shelf } : {}),
                        ...(search ? { q: search } : {}),
                    },
                })
            );
        },
        options
    );
}

/** Everyone else's reviews of an item, a page at a time. */
export function useItemReviews(
    id: MaybeRefOrGetter<string>,
    options: PaginatedListOptions = {}
) {
    return usePaginatedList(
        () => [...itemKey(toValue(id)), 'reviews'],
        async (offset) =>
            unwrap(
                await api.items[':id'].reviews.$get({
                    param: { id: toValue(id) },
                    query: { offset },
                })
            ),
        options
    );
}

type ShelfEdition = {
    collectionId: string;
    isbn: z.input<typeof IsbnSchema>;
};

// Owning an edition changes the item's page, its shelf's counts and the
// series pages that mark what you own.
function refreshOwnership(queryClient: QueryClient) {
    return Promise.all(
        [ITEMS_KEY, COLLECTIONS_KEY, SERIES_KEY].map((queryKey) =>
            queryClient.invalidateQueries({ queryKey })
        )
    );
}

/**
 * Puts an edition of an item on a shelf, adding the item if the shelf
 * doesn't have it. A new ISBN joins the item and waits on an admin.
 */
export function useOwnEdition() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            collectionId,
            isbn,
            catalogItemId,
        }: ShelfEdition & { catalogItemId: string }) =>
            unwrap(
                await api.collections[':id'].editions[':isbn'].$put({
                    param: { id: collectionId, isbn },
                    json: { catalogItemId },
                })
            ),
        onSuccess: () => refreshOwnership(queryClient),
    });
}

/**
 * Takes an edition off a shelf. Taking off the last one removes the item
 * from the shelf, and `removedEntry` says so.
 */
export function useDisownEdition() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ collectionId, isbn }: ShelfEdition) =>
            unwrap(
                await api.collections[':id'].editions[':isbn'].$delete({
                    param: { id: collectionId, isbn },
                })
            ),
        onSuccess: () => refreshOwnership(queryClient),
    });
}
