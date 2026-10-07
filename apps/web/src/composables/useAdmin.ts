import type { InferResponseType } from '@analog/api/client';
import {
    type AddBookSchema,
    type AddedSort,
    type AdminItemListQuerySchema,
    type AdminListQuerySchema,
    DEFAULT_PAGE_SIZE,
    type IsbnSchema,
    type MergeItemSchema,
    type MergeSeriesSchema,
    type SetGenresSchema,
    type SetSeriesItemsSchema,
    type SetVerifiedSchema,
    type UpdateCatalogItemSchema,
    type UpdateIsbnSchema,
    type UpdateItemDetailsSchema,
    type UpdateNameSchema,
    type UpdateSeriesSchema,
} from '@analog/types';
import { type ApiClient, api, unwrap } from '@/lib/api';

import { GOOGLE_KEY } from './useCatalog';
import {
    type PaginatedListOptions,
    usePaginatedList,
} from './usePaginatedList';
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/vue-query';
import { useFileDialog } from '@vueuse/core';
import { type MaybeRefOrGetter, ref, toValue } from 'vue';
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

/** People and publishers: the two kinds of names admins fix. */
export type NameKind = 'people' | 'publishers';

function namesApi(kind: NameKind) {
    return kind === 'people' ? api.admin.people : api.admin.publishers;
}

/** Names that match `q` or one of their other spellings, for pickers. */
export function useAdminNameSearch(
    kind: NameKind,
    q: MaybeRefOrGetter<string>,
    options: PaginatedListOptions = {}
) {
    return usePaginatedList(
        () => [...ADMIN_KEY, kind, 'search', toValue(q)],
        async (offset) =>
            unwrap(
                await namesApi(kind).search.$get({
                    query: { q: toValue(q), offset },
                })
            ),
        { enabled: () => toValue(q) !== '', ...options }
    );
}

export type AdminNameRow = InferResponseType<
    ApiClient['admin']['people']['$get'],
    200
>['items'][number];

export function useAdminNames(
    kind: MaybeRefOrGetter<NameKind>,
    query: MaybeRefOrGetter<{ q: string; page: number }>
) {
    return useQuery({
        queryKey: () => [...ADMIN_KEY, toValue(kind), 'list', toValue(query)],
        queryFn: async () => {
            const { q, page } = toValue(query);
            return unwrap(
                await namesApi(toValue(kind)).$get({
                    query: {
                        ...(q ? { q } : {}),
                        limit: String(DEFAULT_PAGE_SIZE),
                        offset: String((page - 1) * DEFAULT_PAGE_SIZE),
                    },
                })
            );
        },
        placeholderData: keepPreviousData,
    });
}

export function useAdminName(kind: NameKind, id: MaybeRefOrGetter<string>) {
    return useQuery({
        queryKey: () => [...ADMIN_KEY, kind, 'detail', toValue(id)],
        queryFn: async () =>
            unwrap(
                await namesApi(kind)[':id'].$get({
                    param: { id: toValue(id) },
                })
            ),
    });
}

export function useUpdateName(kind: NameKind) {
    const { afterEdit } = useInvalidateAll();
    return useMutation({
        mutationFn: async ({
            id,
            ...json
        }: z.input<typeof UpdateNameSchema> & { id: string }) =>
            unwrap(await namesApi(kind)[':id'].$put({ param: { id }, json })),
        onSuccess: afterEdit,
    });
}

/** A publisher's page, with the publisher it's an imprint of. */
export function useAdminPublisher(
    id: MaybeRefOrGetter<string>,
    enabled: MaybeRefOrGetter<boolean>
) {
    return useQuery({
        enabled: () => toValue(enabled),
        queryKey: () => [...ADMIN_KEY, 'publishers', 'detail', toValue(id)],
        queryFn: async () =>
            unwrap(
                await api.admin.publishers[':id'].$get({
                    param: { id: toValue(id) },
                })
            ),
    });
}

/** Makes a publisher an imprint of another, or not one with null. */
export function useSetParentPublisher() {
    const { afterEdit } = useInvalidateAll();
    return useMutation({
        mutationFn: async ({
            id,
            parentId,
        }: {
            id: string;
            parentId: string | null;
        }) =>
            unwrap(
                await api.admin.publishers[':id'].parent.$put({
                    param: { id },
                    json: { parentId },
                })
            ),
        onSuccess: afterEdit,
    });
}

export function useMergeName(kind: NameKind) {
    const { afterDelete } = useInvalidateAll();
    return useMutation({
        mutationFn: async ({ id, intoId }: { id: string; intoId: string }) =>
            unwrap(
                await namesApi(kind)[':id'].merge.$post({
                    param: { id },
                    json: { intoId },
                })
            ),
        onSuccess: afterDelete,
    });
}

export function useUpdateItemDetails() {
    const { afterEdit } = useInvalidateAll();
    return useMutation({
        mutationFn: async ({
            itemId,
            ...json
        }: z.input<typeof UpdateItemDetailsSchema> & { itemId: string }) =>
            unwrap(
                await api.admin.items[':id'].details.$put({
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

export function useUpdateIsbn() {
    const { afterEdit } = useInvalidateAll();
    return useMutation({
        mutationFn: async ({
            itemId,
            isbn,
            ...json
        }: ItemIsbn & z.input<typeof UpdateIsbnSchema>) =>
            unwrap(
                await api.admin.items[':id'].isbns[':isbn'].$put({
                    param: { id: itemId, isbn },
                    json,
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

/** Takes a mistaken ISBN off an item. */
export function useRemoveIsbn() {
    const { afterEdit } = useInvalidateAll();
    return useMutation({
        mutationFn: async ({ itemId, isbn }: ItemIsbn) =>
            unwrap(
                await api.admin.items[':id'].isbns[':isbn'].$delete({
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

export function useSetSeriesGenres() {
    const { afterEdit } = useInvalidateAll();
    return useMutation({
        mutationFn: async ({
            seriesId,
            ...json
        }: z.input<typeof SetGenresSchema> & { seriesId: string }) =>
            unwrap(
                await api.admin.series[':id'].genres.$put({
                    param: { id: seriesId },
                    json,
                })
            ),
        onSuccess: afterEdit,
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

export interface NewVolume {
    isbn: string;
    googleId: string;
    title: string;
    volume: number | null;
}

export interface VolumeProblem extends NewVolume {
    // The item that already has the ISBN, when that's the problem.
    itemId: string | null;
    message: string;
}

/**
 * Adds books to a series one request at a time, counting them in `done`.
 * A book whose ISBN is already on another item stays there, and one that
 * fails doesn't stop the rest. Both come back as problems. Everything
 * refreshes once at the end.
 */
export function useAddSeriesVolumes() {
    const { afterEdit } = useInvalidateAll();
    const done = ref(0);
    const mutation = useMutation({
        mutationFn: async ({
            seriesId,
            volumes,
        }: {
            seriesId: string;
            volumes: NewVolume[];
        }) => {
            done.value = 0;
            const problems: VolumeProblem[] = [];
            for (const volume of volumes) {
                try {
                    const item = await unwrap(
                        await api.admin.items.$post({
                            json: {
                                isbn: volume.isbn,
                                googleId: volume.googleId,
                                series: { id: seriesId },
                                volume: volume.volume,
                            },
                        })
                    );
                    if (item.seriesId !== seriesId) {
                        problems.push({
                            ...volume,
                            itemId: item.id,
                            message: 'Already on another book',
                        });
                    }
                } catch (err) {
                    problems.push({
                        ...volume,
                        itemId: null,
                        message: err instanceof Error ? err.message : '',
                    });
                }
                done.value += 1;
            }
            return problems;
        },
        onSettled: afterEdit,
    });
    return { ...mutation, done };
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

export type AdminCheck = InferResponseType<
    ApiClient['admin']['checks']['items'][':id']['$get'],
    200
>[number];

/** The suggestions `pnpm catalog:check` left on an item. */
export function useItemChecks(id: MaybeRefOrGetter<string>) {
    return useQuery({
        queryKey: () => [...ADMIN_KEY, 'checks', 'item', toValue(id)],
        queryFn: async () =>
            unwrap(
                await api.admin.checks.items[':id'].$get({
                    param: { id: toValue(id) },
                })
            ),
    });
}

/** A series' suggestions and its items'. */
export function useSeriesChecks(id: MaybeRefOrGetter<string>) {
    return useQuery({
        queryKey: () => [...ADMIN_KEY, 'checks', 'series', toValue(id)],
        queryFn: async () =>
            unwrap(
                await api.admin.checks.series[':id'].$get({
                    param: { id: toValue(id) },
                })
            ),
    });
}

/** Makes the change a problem suggests, and clears it. */
export function useAcceptCheck() {
    const { afterEdit } = useInvalidateAll();
    return useMutation({
        mutationFn: async (checkId: string) =>
            unwrap(
                await api.admin.checks[':id'].accept.$post({
                    param: { id: checkId },
                })
            ),
        onSuccess: afterEdit,
    });
}

/** Hides a problem. Later checks don't flag it again. */
export function useDismissCheck() {
    const { afterEdit } = useInvalidateAll();
    return useMutation({
        mutationFn: async (checkId: string) =>
            unwrap(
                await api.admin.checks[':id'].dismiss.$post({
                    param: { id: checkId },
                })
            ),
        onSuccess: afterEdit,
    });
}

export type AdminCheckRun = InferResponseType<
    ApiClient['admin']['checks']['runs']['$get'],
    200
>['items'][number];

/** One page of the Jev check history, counting pages from 1. */
export function useAdminCheckRuns(
    query: MaybeRefOrGetter<{ page: number; sort: AddedSort }>
) {
    return useQuery({
        queryKey: () => [...ADMIN_KEY, 'checks', 'runs', toValue(query)],
        queryFn: async () => {
            const { page, sort } = toValue(query);
            return unwrap(
                await api.admin.checks.runs.$get({
                    query: {
                        sort,
                        limit: String(DEFAULT_PAGE_SIZE),
                        offset: String((page - 1) * DEFAULT_PAGE_SIZE),
                    },
                })
            );
        },
        placeholderData: keepPreviousData,
    });
}

/** Runs and TypeSafe tokens, over the last week and all time. */
export function useAdminCheckUsage() {
    return useQuery({
        queryKey: [...ADMIN_KEY, 'checks', 'usage'],
        queryFn: async () => unwrap(await api.admin.checks.usage.$get()),
    });
}
