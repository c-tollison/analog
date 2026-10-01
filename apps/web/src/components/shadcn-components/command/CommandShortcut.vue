<script setup lang="ts">
import { cn } from '@/lib/utils';

import type { HTMLAttributes } from 'vue';

const props = defineProps<{
    class?: HTMLAttributes['class'];
}>();
</script>

<template>
    <span
        data-slot="command-shortcut"
        :class="cn('text-muted-foreground group-data-highlighted/command-item:text-foreground ml-auto text-[0.625rem] tracking-widest', props.class)"
    >
        <slot />
    </span>
</template>
