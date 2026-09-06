<script setup lang="ts">
import { cn } from '@/lib/utils';

import type { HTMLAttributes } from 'vue';

const props = defineProps<{
    class?: HTMLAttributes['class'];
}>();
</script>

<template>
    <div
        data-slot="card-footer"
        :class="cn('rounded-b-lg px-4 group-data-[size=sm]/card:px-3 [.border-t]:pt-4 group-data-[size=sm]/card:[.border-t]:pt-3 flex items-center', props.class)"
    >
        <slot />
    </div>
</template>
