<script setup lang="ts" generic="T">
import FormError from '@/components/FormError.vue';
import LoadMore from '@/components/lists/LoadMore.vue';
import { Spinner } from '@/components/shadcn-components/spinner';
import type { PaginatedList } from '@/composables/usePaginatedList';

defineProps<{
    list: PaginatedList<T>;
    emptyText: string;
}>();

defineSlots<{ default(props: { items: T[] }): unknown }>();
</script>

<template>
    <div class="grid gap-2">
        <FormError :message="list.error" />

        <div
            v-if="list.isLoading && !list.items.length"
            class="flex justify-center p-8"
        >
            <Spinner class="size-6" />
        </div>
        <p
            v-else-if="!list.isLoading && !list.error && !list.items.length"
            class="text-muted-foreground p-8 text-center text-sm"
        >
            {{ emptyText }}
        </p>

        <div
            v-if="list.items.length"
            :class="{ 'opacity-60 transition-opacity': list.isLoading }"
        >
            <slot :items="list.items" />
        </div>

        <LoadMore
            v-if="list.items.length"
            :has-more="list.hasMore"
            :loading="list.isLoadingMore"
            @load="list.loadMore"
        />
    </div>
</template>
