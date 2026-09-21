<script setup lang="ts">
import { Input } from '@/components/shadcn-components/input';
import { cn } from '@/lib/utils';

import type { HTMLAttributes } from 'vue';

const props = defineProps<{
    class?: HTMLAttributes['class'];
}>();
</script>

<template>
    <Input
        data-slot="input-group-control"
        :class="cn(
      'rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent flex-1',
      props.class,
    )"
    />
</template>
