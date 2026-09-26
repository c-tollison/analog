import type { InferResponseType } from '@analog/api/client';
import {
    type AdminListQuerySchema,
    DEFAULT_PAGE_SIZE,
    type MergeSeriesSchema,
    type SetSeriesItemsSchema,
    type SetVerifiedSchema,
    type UpdateCatalogItemSchema,
    type UpdateSeriesSchema,
} from '@analog/types';
import { type ApiClient, api, unwrap } from '@/lib/api';

import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import type { z } from 'zod';

export const ADMIN_KEY = ['admin'] as const;

export type AdminListQuery = z.output<typeof AdminListQuerySchema>;

export type AdminListFilters = Pick<AdminListQuery, 'q' | 'status' | 'sort'>;

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
 * Admin edits change data every page shows, so everything is refetched.
 * After a delete, nothing refetches until it's shown again, so the deleted
 * row's page doesn't reload first.
 */
function useInvalidateAll() {
    const queryClient = useQueryClient();
    return {
        afterEdit: () => queryClient.invalidateQueries(),
        afterDelete: () =>
            queryClient.invalidateQueries({ refetchType: 'none' }),
    };
}

export function useAdminItems(query: MaybeRefOrGetter<AdminListQuery>) {
    return useQuery({
        queryKey: () => [...ADMIN_KEY, 'items', 'list', toValue(query)],
        queryFn: async () =>
            unwrap(
                await api.admin.items.$get({
                    query: listQuery(toValue(query)),
                })
            ),
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
