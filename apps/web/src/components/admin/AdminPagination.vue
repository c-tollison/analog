<script setup lang="ts">
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
} from '@/components/shadcn-components/pagination';

defineProps<{ total: number; pageSize: number }>();

const page = defineModel<number>('page', { required: true });
</script>

<template>
    <Pagination
        v-if="total > pageSize"
        v-model:page="page"
        :total="total"
        :items-per-page="pageSize"
        :sibling-count="1"
        show-edges
    >
        <PaginationContent v-slot="{ items }">
            <PaginationPrevious />
            <template v-for="(item, index) in items" :key="index">
                <PaginationItem
                    v-if="item.type === 'page'"
                    :value="item.value"
                    :is-active="item.value === page"
                >
                    {{ item.value }}
                </PaginationItem>
                <PaginationEllipsis v-else :index="index" />
            </template>
            <PaginationNext />
        </PaginationContent>
    </Pagination>
</template>
