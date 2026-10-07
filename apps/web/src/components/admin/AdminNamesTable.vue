<script setup lang="ts">
import type { AddedSort } from '@analog/types';
import AdminTable from '@/components/admin/AdminTable.vue';
import { WIDE_ONLY } from '@/components/admin/columns';
import {
    type AdminNameRow,
    type NameKind,
    useAdminNames,
} from '@/composables/useAdmin';

import type { ColumnDef } from '@tanstack/vue-table';
import { h } from 'vue';

// People or publishers by name, with how much uses each.
const props = defineProps<{ kind: NameKind; q: string }>();

const page = defineModel<number>('page', { required: true });
// Names sort by name, so this only keeps the table's shape.
const sort = defineModel<AddedSort>('sort', { required: true });

const { data, error, isLoading, isFetching } = useAdminNames(
    () => props.kind,
    () => ({ q: props.q, page: page.value })
);

function rowTo(row: AdminNameRow) {
    return {
        name: props.kind === 'people' ? 'admin-person' : 'admin-publisher',
        params: { id: row.id },
    };
}

const columns: ColumnDef<AdminNameRow>[] = [
    {
        id: 'name',
        header: 'Name',
        meta: { class: 'w-full whitespace-normal md:w-auto' },
        cell: ({ row }) =>
            h('div', { class: 'grid gap-0.5' }, [
                h('span', { class: 'font-medium' }, row.original.name),
                row.original.aliases.length
                    ? h(
                          'span',
                          { class: 'text-muted-foreground md:hidden' },
                          row.original.aliases.join(', ')
                      )
                    : null,
            ]),
    },
    {
        id: 'aliases',
        header: 'Other spellings',
        meta: { class: `${WIDE_ONLY.class} whitespace-normal` },
        cell: ({ row }) => row.original.aliases.join(', '),
    },
    {
        id: 'uses',
        header: () => (props.kind === 'people' ? 'Books' : 'ISBNs'),
        cell: ({ row }) => row.original.uses,
    },
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
        :row-to="rowTo"
    />
</template>
