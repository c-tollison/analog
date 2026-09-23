<script setup lang="ts">
import { cn } from '@/lib/utils';

import type { HTMLAttributes } from 'vue';

const props = defineProps<{
    class?: HTMLAttributes['class'];
}>();
</script>

<template>
    <div
        data-slot="empty-title"
        :class="cn('text-sm font-medium tracking-tight cn-font-heading', props.class)"
    >
        <slot />
    </div>
</template>
