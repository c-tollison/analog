<script setup lang="ts">
import type { AddedSort, VerifiedFilter } from '@analog/types';
import AdminTable from '@/components/admin/AdminTable.vue';
import {
    addedColumn,
    coverColumn,
    titleColumn,
} from '@/components/admin/columns';
import { Button } from '@/components/shadcn-components/button';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    type AdminItemRow,
    adminListQuery,
    useAdminItems,
    useUploadCover,
} from '@/composables/useAdmin';
import { isPendingFor } from '@/lib/editions';
import { SERIES_KIND_LABELS } from '@/lib/media-types';

import { UploadIcon } from '@lucide/vue';
import type { ColumnDef } from '@tanstack/vue-table';
import { h } from 'vue';

const props = defineProps<{
    q: string;
    status: VerifiedFilter;
    // Only items with no cover, each with a button to upload one.
    noCover?: boolean;
}>();

const page = defineModel<number>('page', { required: true });
const sort = defineModel<AddedSort>('sort', { required: true });

const { data, error, isLoading, isFetching } = useAdminItems(() => ({
    ...adminListQuery(
        { q: props.q, status: props.status, sort: sort.value },
        page.value
    ),
    noCover: props.noCover,
}));

const { upload, choose } = useUploadCover();

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

// Uploads to the main ISBN, which sets the item's cover.
const uploadColumn: ColumnDef<AdminItemRow> = {
    id: 'upload',
    header: '',
    cell: ({ row }) => {
        const { id, mainIsbn } = row.original;
        if (!mainIsbn) return null;
        return h(
            Button,
            {
                variant: 'outline',
                size: 'sm',
                disabled: upload.isPending.value,
                onClick: (event: MouseEvent) => {
                    event.stopPropagation();
                    choose({ itemId: id, isbn: mainIsbn });
                },
            },
            () => [
                isPendingFor(upload, mainIsbn) ? h(Spinner) : h(UploadIcon),
                'Upload cover',
            ]
        );
    },
};
</script>

<template>
    <AdminTable
        v-model:page="page"
        v-model:sort="sort"
        :result="data"
        :is-loading="isLoading"
        :is-fetching="isFetching"
        :error="error ?? upload.error.value"
        :columns="noCover ? [...columns, uploadColumn] : columns"
        :row-to="itemTo"
    />
</template>
