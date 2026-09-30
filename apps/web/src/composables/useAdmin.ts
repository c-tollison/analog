import type { InferResponseType } from '@analog/api/client';
import {
    type AddBookSchema,
    type AdminItemListQuerySchema,
    type AdminListQuerySchema,
    DEFAULT_PAGE_SIZE,
    type IsbnSchema,
    type MergeItemSchema,
    type MergeSeriesSchema,
    type SetSeriesItemsSchema,
    type SetVerifiedSchema,
    type UpdateCatalogItemSchema,
    type UpdateSeriesSchema,
} from '@analog/types';
import { type ApiClient, api, unwrap } from '@/lib/api';

import { GOOGLE_KEY } from './useCatalog';
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/vue-query';
import { useFileDialog } from '@vueuse/core';
import { type MaybeRefOrGetter, toValue } from 'vue';
import type { z } from 'zod';

export const ADMIN_KEY = ['admin'] as const;

export type AdminListQuery = z.output<typeof AdminListQuerySchema>;

export type AdminListFilters = Pick<AdminListQuery, 'q' | 'status' | 'sort'>;

export type AdminItemListQuery = AdminListQuery &
    Partial<Pick<z.output<typeof AdminItemListQuerySchema>, 'noCover'>>;

/** The query for one page of an admin table, counting pages from 1. */
export function adminListQuery(
    filters: AdminListFilters,
    page: number
): AdminListQuery {
    return {
        ...filters,
        limit: DEFAULT_PAGE_SIZE,
        offset: (page - 1) * DEFAULT_PAGE_SIZE,
    };
}

export type AdminItemRow = InferResponseType<
    ApiClient['admin']['items']['$get'],
    200
>['items'][number];

export type AdminSeriesRow = InferResponseType<
    ApiClient['admin']['series']['$get'],
    200
>['items'][number];

export type AdminItem = InferResponseType<
    ApiClient['admin']['items'][':id']['$get'],
    200
>;

export type AdminSeries = InferResponseType<
    ApiClient['admin']['series'][':id']['$get'],
    200
>;

export type AdminSeriesItem = InferResponseType<
    ApiClient['admin']['series'][':id']['items']['$get'],
    200
>[number];

function listQuery({ q, status, sort, limit, offset }: AdminListQuery) {
    return {
        ...(q ? { q } : {}),
        status,
        sort,
        limit: String(limit),
        offset: String(offset),
    };
}

/**
 * Admin edits change data every page shows, so everything is refetched,
 * except Google searches, which don't change and count against a limit.
 * After a delete, nothing refetches until it's shown again, so the deleted
 * row's page doesn't reload first.
 */
function useInvalidateAll() {
    const queryClient = useQueryClient();
    const predicate = ({ queryKey }: { queryKey: readonly unknown[] }) =>
        queryKey[0] !== GOOGLE_KEY[0];
    return {
        afterEdit: () => queryClient.invalidateQueries({ predicate }),
        afterDelete: () =>
            queryClient.invalidateQueries({ predicate, refetchType: 'none' }),
    };
}

export function useAdminItems(
    query: MaybeRefOrGetter<AdminItemListQuery>,
    enabled: MaybeRefOrGetter<boolean> = true
) {
    return useQuery({
        enabled: () => toValue(enabled),
        queryKey: () => [...ADMIN_KEY, 'items', 'list', toValue(query)],
        queryFn: async () => {
            const { noCover, ...rest } = toValue(query);
            return unwrap(
                await api.admin.items.$get({
                    query: {
                        ...listQuery(rest),
                        ...(noCover ? { noCover: 'true' } : {}),
                    },
                })
            );
        },
        placeholderData: keepPreviousData,
    });
}

export function useAdminItem(id: MaybeRefOrGetter<string>) {
    return useQuery({
        queryKey: () => [...ADMIN_KEY, 'items', 'detail', toValue(id)],
        queryFn: async () =>
            unwrap(
                await api.admin.items[':id'].$get({
                    param: { id: toValue(id) },
                })
            ),
    });
}

export function useUpdateAdminItem() {
    const { afterEdit } = useInvalidateAll();
    return useMutation({
        mutationFn: async ({
            itemId,
            ...json
        }: z.input<typeof UpdateCatalogItemSchema> & { itemId: string }) =>
            unwrap(
                await api.admin.items[':id'].$put({
                    param: { id: itemId },
                    json,
                })
            ),
        onSuccess: afterEdit,
    });
}

export function useSetItemVerified() {
    const { afterEdit } = useInvalidateAll();
    return useMutation({
        mutationFn: async ({
            itemId,
            verified,
        }: z.input<typeof SetVerifiedSchema> & { itemId: string }) =>
            unwrap(
                await api.admin.items[':id'].verified.$put({
                    param: { id: itemId },
                    json: { verified },
                })
            ),
        onSuccess: afterEdit,
    });
}

export function useDeleteAdminItem() {
    const { afterDelete } = useInvalidateAll();
    return useMutation({
        mutationFn: async (itemId: string) =>
            unwrap(
                await api.admin.items[':id'].$delete({ param: { id: itemId } })
            ),
        onSuccess: afterDelete,
    });
}

type ItemIsbn = { itemId: string; isbn: z.input<typeof IsbnSchema> };

/** Marks an ISBN a scan added as checked. */
export function useApproveIsbn() {
    const { afterEdit } = useInvalidateAll();
    return useMutation({
        mutationFn: async ({ itemId, isbn }: ItemIsbn) =>
            unwrap(
                await api.admin.items[':id'].isbns[':isbn'].approve.$put({
                    param: { id: itemId, isbn },
                })
            ),
        onSuccess: afterEdit,
    });
}

/** Makes one of an item's ISBNs its own item. Returns the new item's id. */
export function useSplitIsbn() {
    const { afterEdit } = useInvalidateAll();
    return useMutation({
        mutationFn: async ({ itemId, isbn }: ItemIsbn) =>
            unwrap(
                await api.admin.items[':id'].isbns[':isbn'].split.$post({
                    param: { id: itemId, isbn },
                })
            ),
        onSuccess: afterEdit,
    });
}

/**
 * Uploads a cover for one of an item's ISBNs. `choose` opens the file picker,
 * and the upload starts once an image is picked.
 */
export function useUploadCover() {
    const { afterEdit } = useInvalidateAll();
    const upload = useMutation({
        mutationFn: async ({ itemId, isbn, file }: ItemIsbn & { file: File }) =>
            unwrap(
                await api.admin.items[':id'].isbns[':isbn'].cover.$put({
                    param: { id: itemId, isbn },
                    form: { file },
                })
            ),
        onSuccess: afterEdit,
    });

    let chosen: ItemIsbn | undefined;
    const picker = useFileDialog({
        accept: 'image/*',
        multiple: false,
        reset: true,
    });
    picker.onChange((files) => {
        const file = files?.[0];
        if (file && chosen) {
            upload.mutate({ ...chosen, file });
        }
    });

    function choose(target: ItemIsbn) {
        chosen = target;
        upload.reset();
        picker.open();
    }

    return { upload, choose };
}

export function useAdminSeriesList(query: MaybeRefOrGetter<AdminListQuery>) {
    return useQuery({
        queryKey: () => [...ADMIN_KEY, 'series', 'list', toValue(query)],
        queryFn: async () =>
            unwrap(
                await api.admin.series.$get({
                    query: listQuery(toValue(query)),
                })
            ),
        placeholderData: keepPreviousData,
    });
}

export function useAdminSeries(id: MaybeRefOrGetter<string>) {
    return useQuery({
        queryKey: () => [...ADMIN_KEY, 'series', 'detail', toValue(id)],
        queryFn: async () =>
            unwrap(
                await api.admin.series[':id'].$get({
                    param: { id: toValue(id) },
                })
            ),
    });
}

export function useAdminSeriesItems(id: MaybeRefOrGetter<string>) {
    return useQuery({
        queryKey: () => [...ADMIN_KEY, 'series', 'items', toValue(id)],
        queryFn: async () =>
            unwrap(
                await api.admin.series[':id'].items.$get({
                    param: { id: toValue(id) },
                })
            ),
    });
}

export function useUpdateAdminSeries() {
    const { afterEdit } = useInvalidateAll();
    return useMutation({
        mutationFn: async ({
            seriesId,
            ...json
        }: z.input<typeof UpdateSeriesSchema> & { seriesId: string }) =>
            unwrap(
                await api.admin.series[':id'].$put({
                    param: { id: seriesId },
                    json,
                })
            ),
        onSuccess: afterEdit,
    });
}

export function useSetSeriesItems() {
    const { afterEdit } = useInvalidateAll();
    return useMutation({
        mutationFn: async ({
            seriesId,
            ...json
        }: z.input<typeof SetSeriesItemsSchema> & { seriesId: string }) =>
            unwrap(
                await api.admin.series[':id'].items.$put({
                    param: { id: seriesId },
                    json,
                })
            ),
        onSuccess: afterEdit,
    });
}

export function useSetSeriesVerified() {
    const { afterEdit } = useInvalidateAll();
    return useMutation({
        mutationFn: async ({
            seriesId,
            verified,
        }: z.input<typeof SetVerifiedSchema> & { seriesId: string }) =>
            unwrap(
                await api.admin.series[':id'].verified.$put({
                    param: { id: seriesId },
                    json: { verified },
                })
            ),
        onSuccess: afterEdit,
    });
}

/** Adds a book to the shared catalog, without a collection. */
export function useSaveAdminBook() {
    const { afterEdit } = useInvalidateAll();
    return useMutation({
        mutationFn: async (json: z.output<typeof AddBookSchema>) =>
            unwrap(await api.admin.items.$post({ json })),
        onSuccess: afterEdit,
    });
}

export function useMergeItem() {
    const { afterDelete } = useInvalidateAll();
    return useMutation({
        mutationFn: async ({
            itemId,
            ...json
        }: z.input<typeof MergeItemSchema> & { itemId: string }) =>
            unwrap(
                await api.admin.items[':id'].merge.$post({
                    param: { id: itemId },
                    json,
                })
            ),
        onSuccess: afterDelete,
    });
}

export function useMergeSeries() {
    const { afterDelete } = useInvalidateAll();
    return useMutation({
        mutationFn: async ({
            seriesId,
            ...json
        }: z.input<typeof MergeSeriesSchema> & { seriesId: string }) =>
            unwrap(
                await api.admin.series[':id'].merge.$post({
                    param: { id: seriesId },
                    json,
                })
            ),
        onSuccess: afterDelete,
    });
}

export function useDeleteAdminSeries() {
    const { afterDelete } = useInvalidateAll();
    return useMutation({
        mutationFn: async (seriesId: string) =>
            unwrap(
                await api.admin.series[':id'].$delete({
                    param: { id: seriesId },
                })
            ),
        onSuccess: afterDelete,
    });
}
