<script setup lang="ts">
import { Button } from '@/components/shadcn-components/button';

import { ArrowDownIcon, ArrowUpIcon } from '@lucide/vue';

// A date column header, which flips between newest and oldest first.
withDefaults(defineProps<{ newestFirst: boolean; label?: string }>(), {
    label: 'Added',
});

const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
    <Button variant="ghost" size="sm" class="-ml-3" @click="emit('toggle')">
        {{ label }}
        <ArrowDownIcon v-if="newestFirst" />
        <ArrowUpIcon v-else />
    </Button>
</template>
