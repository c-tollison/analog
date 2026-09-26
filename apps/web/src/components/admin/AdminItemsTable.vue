<script setup lang="ts">
import {
    AddedSort,
    DEFAULT_PAGE_SIZE,
    type VerifiedFilter,
} from '@analog/types';
import AddedHeader from '@/components/admin/AddedHeader.vue';
import AdminPagination from '@/components/admin/AdminPagination.vue';
import AdminTable from '@/components/admin/AdminTable.vue';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Spinner } from '@/components/shadcn-components/spinner';
import { type AdminItemRow, useAdminItems } from '@/composables/useAdmin';
import { formatDate } from '@/lib/dates';
import { SERIES_KIND_LABELS } from '@/lib/media-types';

import type { ColumnDef, SortingState } from '@tanstack/vue-table';
import { computed, h } from 'vue';
import { RouterLink } from 'vue-router';

const props = defineProps<{ q: string; status: VerifiedFilter }>();

const page = defineModel<number>('page', { required: true });
const sort = defineModel<AddedSort>('sort', { required: true });

const { data, error, isLoading, isFetching } = useAdminItems(() => ({
    q: props.q,
    status: props.status,
    sort: sort.value,
    limit: DEFAULT_PAGE_SIZE,
    offset: (page.value - 1) * DEFAULT_PAGE_SIZE,
}));

const sorting = computed<SortingState>({
    get: () => [{ id: 'createdAt', desc: sort.value === AddedSort.Newest }],
    set: ([first]) => {
        sort.value = first?.desc ? AddedSort.Newest : AddedSort.Oldest;
        page.value = 1;
    },
});

const itemTo = (row: AdminItemRow) => ({
    name: 'admin-item',
    params: { id: row.id },
});

const columns: ColumnDef<AdminItemRow>[] = [
    {
        id: 'cover',
        header: '',
        cell: ({ row }) =>
            h(CoverImage, {
                size: 'sm',
                src: row.original.coverUrl,
                alt: '',
                class: 'h-12 w-8',
            }),
    },
    {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) =>
            h('div', { class: 'flex items-center gap-2' }, [
                h(
                    RouterLink,
                    {
                        to: itemTo(row.original),
                        class: 'font-medium hover:underline',
                        onClick: (event: MouseEvent) => event.stopPropagation(),
                    },
                    () => row.original.title
                ),
                row.original.verifiedAt
                    ? h(Badge, { variant: 'secondary' }, () => 'Verified')
                    : null,
            ]),
    },
    {
        accessorKey: 'seriesTitle',
        header: 'Series',
        cell: ({ row }) => row.original.seriesTitle ?? '—',
    },
    {
        accessorKey: 'position',
        header: 'Volume',
        cell: ({ row }) => row.original.position ?? '—',
    },
    {
        accessorKey: 'kind',
        header: 'Kind',
        cell: ({ row }) =>
            row.original.kind ? SERIES_KIND_LABELS[row.original.kind] : '—',
    },
    {
        accessorKey: 'addedBy',
        header: 'Added by',
        cell: ({ row }) => row.original.addedBy ?? '—',
    },
    {
        accessorKey: 'createdAt',
        header: ({ column }) =>
            h(AddedHeader, {
                newestFirst: sort.value === AddedSort.Newest,
                onToggle: () => column.toggleSorting(),
            }),
        cell: ({ row }) => formatDate(row.original.createdAt),
    },
];
</script>

<template>
    <div class="grid gap-3">
        <FormError :message="error?.message ?? null" />
        <div v-if="isLoading" class="flex justify-center p-4">
            <Spinner class="size-6" />
        </div>
        <template v-else-if="data">
            <div class="relative">
                <AdminTable
                    v-model:sorting="sorting"
                    :data="data.items"
                    :columns="columns"
                    :row-to="itemTo"
                    empty-text="Nothing here."
                />
                <Spinner v-if="isFetching" class="absolute top-2.5 right-2" />
            </div>
            <AdminPagination
                v-model:page="page"
                :total="data.total"
                :page-size="DEFAULT_PAGE_SIZE"
            />
        </template>
    </div>
</template>
