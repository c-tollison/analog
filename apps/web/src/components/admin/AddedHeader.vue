<script setup lang="ts">
import { Button } from '@/components/shadcn-components/button';

import { ArrowDownIcon, ArrowUpIcon } from '@lucide/vue';

// The "Added" column header, which flips between newest and oldest first.
defineProps<{ newestFirst: boolean }>();

const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
    <Button variant="ghost" size="sm" class="-ml-3" @click="emit('toggle')">
        Added
        <ArrowDownIcon v-if="newestFirst" />
        <ArrowUpIcon v-else />
    </Button>
</template>
