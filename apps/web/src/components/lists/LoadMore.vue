<script setup lang="ts">
import { Spinner } from '@/components/shadcn-components/spinner';

import { useIntersectionObserver } from '@vueuse/core';
import { ref, useTemplateRef, watch } from 'vue';

const props = defineProps<{ hasMore: boolean; loading: boolean }>();
const emit = defineEmits<{ load: [] }>();

const sentinel = useTemplateRef<HTMLElement>('sentinel');
const isVisible = ref(false);

function maybeLoad() {
    if (isVisible.value && props.hasMore && !props.loading) {
        emit('load');
    }
}

useIntersectionObserver(
    sentinel,
    ([entry]) => {
        isVisible.value = entry?.isIntersecting ?? false;
        maybeLoad();
    },
    { rootMargin: '200px' }
);

watch(() => props.loading, maybeLoad);
</script>

<template>
    <div ref="sentinel" class="flex min-h-1 justify-center">
        <Spinner v-if="loading" class="my-4 size-5" />
    </div>
</template>
