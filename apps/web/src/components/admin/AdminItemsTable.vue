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
import { Button } from '@/components/shadcn-components/button';
import { Spinner } from '@/components/shadcn-components/spinner';
import WithTooltip from '@/components/WithTooltip.vue';
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

// e.g. "Bleach · Vol. 1 · Manga"
function details(row: AdminItemRow): string {
    const series =
        row.seriesTitle && row.position !== null
            ? `${row.seriesTitle} · Vol. ${row.position}`
            : row.seriesTitle;
    return [series, row.kind && SERIES_KIND_LABELS[row.kind]]
        .filter(Boolean)
        .join(' · ');
}

const columns: ColumnDef<AdminItemRow>[] = [
    coverColumn(),
    titleColumn(itemTo, details),
    suggestionsColumn(),
    {
        id: 'series',
        header: 'Series',
        cell: ({ row }) => row.original.seriesTitle ?? '—',
        meta: WIDE_ONLY,
    },
    {
        id: 'volume',
        header: 'Volume',
        cell: ({ row }) => row.original.position ?? '—',
        meta: WIDE_ONLY,
    },
    {
        id: 'kind',
        header: 'Kind',
        cell: ({ row }) =>
            row.original.kind ? SERIES_KIND_LABELS[row.original.kind] : '—',
        meta: WIDE_ONLY,
    },
    {
        id: 'addedBy',
        header: 'Added by',
        cell: ({ row }) => row.original.addedBy ?? '—',
        meta: { class: 'hidden lg:table-cell' },
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
        // On phones the button is only an icon.
        return h(WithTooltip, { label: 'Upload cover' }, () =>
            h(
                Button,
                {
                    variant: 'outline',
                    size: 'sm',
                    'aria-label': 'Upload cover',
                    disabled: upload.isPending.value,
                    onClick: (event: MouseEvent) => {
                        event.stopPropagation();
                        choose({ itemId: id, isbn: mainIsbn });
                    },
                },
                () => [
                    isPendingFor(upload, mainIsbn) ? h(Spinner) : h(UploadIcon),
                    h('span', { class: 'hidden sm:inline' }, 'Upload cover'),
                ]
            )
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
