<script setup lang="ts" generic="TData extends { id: string }, TValue">
import {
    Table,
    TableBody,
    TableCell,
    TableEmpty,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/shadcn-components/table';

import {
    type ColumnDef,
    FlexRender,
    getCoreRowModel,
    type SortingState,
    useVueTable,
} from '@tanstack/vue-table';
import { type RouteLocationRaw, useRouter } from 'vue-router';

// Rows come sorted and paged from the API, so the table only lays them out.
const props = defineProps<{
    data: TData[];
    columns: ColumnDef<TData, TValue>[];
    emptyText: string;
    rowTo: (row: TData) => RouteLocationRaw;
}>();

const sorting = defineModel<SortingState>('sorting', { required: true });

const router = useRouter();

const table = useVueTable({
    get data() {
        return props.data;
    },
    get columns() {
        return props.columns;
    },
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableSortingRemoval: false,
    state: {
        get sorting() {
            return sorting.value;
        },
    },
    onSortingChange: (updater) => {
        sorting.value =
            typeof updater === 'function' ? updater(sorting.value) : updater;
    },
});
</script>

<template>
    <Table>
        <TableHeader>
            <TableRow
                v-for="headerGroup in table.getHeaderGroups()"
                :key="headerGroup.id"
            >
                <TableHead
                    v-for="header in headerGroup.headers"
                    :key="header.id"
                >
                    <FlexRender
                        v-if="!header.isPlaceholder"
                        :render="header.column.columnDef.header"
                        :props="header.getContext()"
                    />
                </TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            <template v-if="table.getRowModel().rows.length">
                <TableRow
                    v-for="row in table.getRowModel().rows"
                    :key="row.id"
                    class="cursor-pointer"
                    @click="router.push(rowTo(row.original))"
                >
                    <TableCell
                        v-for="cell in row.getVisibleCells()"
                        :key="cell.id"
                    >
                        <FlexRender
                            :render="cell.column.columnDef.cell"
                            :props="cell.getContext()"
                        />
                    </TableCell>
                </TableRow>
            </template>
            <TableEmpty v-else :colspan="columns.length">
                {{ emptyText }}
            </TableEmpty>
        </TableBody>
    </Table>
</template>
