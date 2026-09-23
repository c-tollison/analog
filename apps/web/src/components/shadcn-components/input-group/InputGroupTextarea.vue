<script setup lang="ts">
import { Textarea } from '@/components/shadcn-components/textarea';
import { cn } from '@/lib/utils';

import type { HTMLAttributes } from 'vue';

const props = defineProps<{
    class?: HTMLAttributes['class'];
}>();
</script>

<template>
    <Textarea
        data-slot="input-group-control"
        :class="cn(
      'rounded-none border-0 bg-transparent py-2 shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent flex-1 resize-none',
      props.class,
    )"
    />
</template>
