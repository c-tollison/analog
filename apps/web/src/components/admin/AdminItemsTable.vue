<script setup lang="ts">
import type { AddedSort, VerifiedFilter } from '@analog/types';
import AdminTable from '@/components/admin/AdminTable.vue';
import {
    addedColumn,
    coverColumn,
    titleColumn,
} from '@/components/admin/columns';
import {
    type AdminItemRow,
    adminListQuery,
    useAdminItems,
} from '@/composables/useAdmin';
import { SERIES_KIND_LABELS } from '@/lib/media-types';

import type { ColumnDef } from '@tanstack/vue-table';

const props = defineProps<{ q: string; status: VerifiedFilter }>();

const page = defineModel<number>('page', { required: true });
const sort = defineModel<AddedSort>('sort', { required: true });

const { data, error, isLoading, isFetching } = useAdminItems(() =>
    adminListQuery(
        { q: props.q, status: props.status, sort: sort.value },
        page.value
    )
);

const itemTo = (row: AdminItemRow) => ({
    name: 'admin-item',
    params: { id: row.id },
});

const columns: ColumnDef<AdminItemRow>[] = [
    coverColumn(),
    titleColumn(itemTo),
    {
        id: 'series',
        header: 'Series',
        cell: ({ row }) => row.original.seriesTitle ?? '—',
    },
    {
        id: 'volume',
        header: 'Volume',
        cell: ({ row }) => row.original.position ?? '—',
    },
    {
        id: 'kind',
        header: 'Kind',
        cell: ({ row }) =>
            row.original.kind ? SERIES_KIND_LABELS[row.original.kind] : '—',
    },
    {
        id: 'addedBy',
        header: 'Added by',
        cell: ({ row }) => row.original.addedBy ?? '—',
    },
    addedColumn(),
];
</script>

<template>
    <AdminTable
        v-model:page="page"
        v-model:sort="sort"
        :result="data"
        :is-loading="isLoading"
        :is-fetching="isFetching"
        :error="error"
        :columns="columns"
        :row-to="itemTo"
    />
</template>
