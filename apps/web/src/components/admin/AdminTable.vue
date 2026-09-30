<script setup lang="ts" generic="TData extends { id: string }">
import { AddedSort, DEFAULT_PAGE_SIZE } from '@analog/types';
import AdminPagination from '@/components/admin/AdminPagination.vue';
import FormError from '@/components/FormError.vue';
import { Spinner } from '@/components/shadcn-components/spinner';
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
import { computed } from 'vue';
import { type RouteLocationRaw, useRouter } from 'vue-router';

// Rows come sorted and paged from the API, so the table only lays them out.
// Only the "Added" column sorts.
const props = defineProps<{
    result: { items: TData[]; total: number } | undefined;
    isLoading: boolean;
    isFetching: boolean;
    error: Error | null;
    columns: ColumnDef<TData>[];
    // Null leaves the row unclickable.
    rowTo: (row: TData) => RouteLocationRaw | null;
}>();

const page = defineModel<number>('page', { required: true });
const sort = defineModel<AddedSort>('sort', { required: true });

const router = useRouter();

function open(row: TData) {
    const to = props.rowTo(row);
    if (to) router.push(to);
}

const sorting = computed<SortingState>({
    get: () => [{ id: 'createdAt', desc: sort.value === AddedSort.Newest }],
    set: ([first]) => {
        sort.value = first?.desc ? AddedSort.Newest : AddedSort.Oldest;
        page.value = 1;
    },
});

const table = useVueTable({
    get data() {
        return props.result?.items ?? [];
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
    <div class="grid gap-3">
        <FormError :message="error?.message ?? null" />
        <div v-if="isLoading" class="flex justify-center p-4">
            <Spinner class="size-6" />
        </div>
        <template v-else-if="result">
            <div class="relative">
                <Table>
                    <TableHeader>
                        <TableRow
                            v-for="headerGroup in table.getHeaderGroups()"
                            :key="headerGroup.id"
                        >
                            <TableHead
                                v-for="header in headerGroup.headers"
                                :key="header.id"
                                :class="header.column.columnDef.meta?.class"
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
                                :class="{
                                    'cursor-pointer': rowTo(row.original),
                                }"
                                @click="open(row.original)"
                            >
                                <TableCell
                                    v-for="cell in row.getVisibleCells()"
                                    :key="cell.id"
                                    :class="cell.column.columnDef.meta?.class"
                                >
                                    <FlexRender
                                        :render="cell.column.columnDef.cell"
                                        :props="cell.getContext()"
                                    />
                                </TableCell>
                            </TableRow>
                        </template>
                        <TableEmpty v-else :colspan="columns.length">
                            Nothing here.
                        </TableEmpty>
                    </TableBody>
                </Table>
                <Spinner v-if="isFetching" class="absolute top-2.5 right-2" />
            </div>
            <AdminPagination
                v-model:page="page"
                :total="result.total"
                :page-size="DEFAULT_PAGE_SIZE"
            />
        </template>
    </div>
</template>
