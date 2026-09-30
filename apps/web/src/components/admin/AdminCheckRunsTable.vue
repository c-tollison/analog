<script setup lang="ts">
import { type AddedSort, CheckTrigger } from '@analog/types';
import AddedHeader from '@/components/admin/AddedHeader.vue';
import AdminTable from '@/components/admin/AdminTable.vue';
import { WIDE_ONLY } from '@/components/admin/columns';
import { Badge } from '@/components/shadcn-components/badge';
import {
    type AdminCheckRun,
    useAdminCheckRuns,
    useAdminCheckUsage,
} from '@/composables/useAdmin';
import { timeAgo } from '@/lib/dates';

import type { ColumnDef } from '@tanstack/vue-table';
import { h } from 'vue';

// Every Jev check of a book or series, with what it cost in TypeSafe tokens.

const TRIGGER_LABELS: Record<CheckTrigger, string> = {
    [CheckTrigger.Scan]: 'Scan',
    [CheckTrigger.Admin]: 'Admin add',
    [CheckTrigger.Refresh]: 'Refresh',
    [CheckTrigger.Sweep]: 'Full check',
};

const page = defineModel<number>('page', { required: true });
const sort = defineModel<AddedSort>('sort', { required: true });

const { data, error, isLoading, isFetching } = useAdminCheckRuns(() => ({
    page: page.value,
    sort: sort.value,
}));
const { data: usage } = useAdminCheckUsage();

const count = (n: number) => n.toLocaleString();

function runTo(row: AdminCheckRun) {
    if (row.catalogItemId) {
        return { name: 'admin-item', params: { id: row.catalogItemId } };
    }
    return row.seriesId
        ? { name: 'admin-series', params: { id: row.seriesId } }
        : null;
}

const columns: ColumnDef<AdminCheckRun>[] = [
    {
        id: 'createdAt',
        accessorFn: (row) => row.createdAt,
        header: ({ column }) =>
            h(AddedHeader, {
                label: 'When',
                newestFirst: column.getIsSorted() === 'desc',
                onToggle: () => column.toggleSorting(),
            }),
        cell: ({ row }) =>
            h(
                'span',
                { title: new Date(row.original.createdAt).toLocaleString() },
                timeAgo(row.original.createdAt)
            ),
    },
    {
        id: 'title',
        header: 'Checked',
        meta: { class: 'w-full whitespace-normal md:w-auto' },
        cell: ({ row }) =>
            h('div', { class: 'grid gap-0.5' }, [
                h('span', { class: 'font-medium' }, [
                    row.original.seriesId && !row.original.catalogItemId
                        ? 'Series: '
                        : '',
                    row.original.title,
                ]),
                h(
                    'span',
                    { class: 'text-muted-foreground md:hidden' },
                    `${TRIGGER_LABELS[row.original.trigger]} · ${count(row.original.inputTokens + row.original.outputTokens)} tokens`
                ),
            ]),
    },
    {
        id: 'trigger',
        header: 'Started by',
        cell: ({ row }) => TRIGGER_LABELS[row.original.trigger],
        meta: WIDE_ONLY,
    },
    {
        id: 'tokens',
        header: 'Tokens',
        cell: ({ row }) =>
            h(
                'span',
                {
                    title: `${count(row.original.inputTokens)} in, ${count(row.original.outputTokens)} out`,
                },
                count(row.original.inputTokens + row.original.outputTokens)
            ),
        meta: WIDE_ONLY,
    },
    {
        id: 'problems',
        header: 'Found',
        cell: ({ row }) =>
            row.original.error
                ? h(
                      Badge,
                      { variant: 'destructive', title: row.original.error },
                      () => 'Failed'
                  )
                : row.original.problems,
    },
];
</script>

<template>
    <div class="grid gap-3">
        <p v-if="usage" class="text-muted-foreground text-sm">
            Last 7 days: {{ count(usage.weekRuns) }} checks,
            {{ count(usage.weekTokens) }} tokens. All time:
            {{ count(usage.runs) }} checks,
            {{ count(usage.tokens) }} tokens<template v-if="usage.failed"
                >, {{ count(usage.failed) }} failed</template
            >.
        </p>
        <AdminTable
            v-model:page="page"
            v-model:sort="sort"
            :result="data"
            :is-loading="isLoading"
            :is-fetching="isFetching"
            :error="error"
            :columns="columns"
            :row-to="runTo"
        />
    </div>
</template>
