<script setup lang="ts">
import type { AddedSort, VerifiedFilter } from '@analog/types';
import AdminTable from '@/components/admin/AdminTable.vue';
import {
    addedColumn,
    coverColumn,
    suggestionsColumn,
    titleColumn,
    WIDE_ONLY,
} from '@/components/admin/columns';
import {
    type AdminSeriesRow,
    adminListQuery,
    useAdminSeriesList,
} from '@/composables/useAdmin';
import { SERIES_KIND_LABELS } from '@/lib/book-labels';

import type { ColumnDef } from '@tanstack/vue-table';

const props = defineProps<{ q: string; status: VerifiedFilter }>();

const page = defineModel<number>('page', { required: true });
const sort = defineModel<AddedSort>('sort', { required: true });

const { data, error, isLoading, isFetching } = useAdminSeriesList(() =>
    adminListQuery(
        { q: props.q, status: props.status, sort: sort.value },
        page.value
    )
);

const seriesTo = (row: AdminSeriesRow) => ({
    name: 'admin-series',
    params: { id: row.id },
});

// e.g. "Manga · 3 of 12 volumes"
function details(row: AdminSeriesRow): string {
    const count = row.volumeCount
        ? `${row.itemCount} of ${row.volumeCount} volumes`
        : `${row.itemCount} books`;
    return `${SERIES_KIND_LABELS[row.kind]} · ${count}`;
}

const columns: ColumnDef<AdminSeriesRow>[] = [
    coverColumn(),
    titleColumn(seriesTo, details),
    suggestionsColumn(),
    {
        id: 'kind',
        header: 'Kind',
        cell: ({ row }) => SERIES_KIND_LABELS[row.original.kind],
        meta: WIDE_ONLY,
    },
    {
        id: 'items',
        header: 'Books',
        cell: ({ row }) => row.original.itemCount,
        meta: WIDE_ONLY,
    },
    {
        id: 'volumeCount',
        header: 'Total volumes',
        cell: ({ row }) => row.original.volumeCount ?? '—',
        meta: WIDE_ONLY,
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
        :row-to="seriesTo"
    />
</template>
