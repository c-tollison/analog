<script setup lang="ts">
import {
    type AddedSort,
    SERIES_LANGUAGE_LABELS,
    type VerifiedFilter,
} from '@analog/types';
import AdminTable from '@/components/admin/AdminTable.vue';
import {
    addedColumn,
    coverColumn,
    titleColumn,
} from '@/components/admin/columns';
import {
    type AdminSeriesRow,
    adminListQuery,
    useAdminSeriesList,
} from '@/composables/useAdmin';
import { SERIES_KIND_LABELS } from '@/lib/media-types';

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

const columns: ColumnDef<AdminSeriesRow>[] = [
    coverColumn(),
    titleColumn(seriesTo),
    {
        id: 'kind',
        header: 'Kind',
        cell: ({ row }) => SERIES_KIND_LABELS[row.original.kind],
    },
    {
        id: 'language',
        header: 'Language',
        cell: ({ row }) =>
            row.original.language
                ? SERIES_LANGUAGE_LABELS[row.original.language]
                : '—',
    },
    {
        id: 'items',
        header: 'Items',
        cell: ({ row }) => row.original.itemCount,
    },
    {
        id: 'volumeCount',
        header: 'Total volumes',
        cell: ({ row }) => row.original.volumeCount ?? '—',
    },
    {
        id: 'anilist',
        header: 'AniList',
        cell: ({ row }) => (row.original.detailsSource ? 'Linked' : '—'),
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
