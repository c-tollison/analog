<script setup lang="ts">
import { Badge } from '@/components/shadcn-components/badge';
import { useNotificationCount } from '@/composables/useNotifications';

import { computed } from 'vue';

const MAX_SHOWN = 9;

const { data } = useNotificationCount();
const count = computed(() => data.value?.count ?? 0);
const label = computed(() =>
    count.value > MAX_SHOWN ? `${MAX_SHOWN}+` : String(count.value)
);
</script>

<template>
    <Badge
        v-if="count"
        class="bg-destructive absolute h-4 min-w-4 px-1 text-white"
    >
        {{ label }}
    </Badge>
</template>
