<script setup lang="ts">
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { useNotificationCount } from '@/composables/useNotifications';

import { BellIcon } from '@lucide/vue';
import { computed } from 'vue';

const MAX_SHOWN = 9;

const { data } = useNotificationCount();
const count = computed(() => data.value?.count ?? 0);
const label = computed(() =>
    count.value > MAX_SHOWN ? `${MAX_SHOWN}+` : String(count.value)
);
</script>

<template>
    <Button
        variant="ghost"
        size="icon-lg"
        class="text-muted-foreground relative"
        as-child
    >
        <RouterLink
            :to="{ name: 'notifications' }"
            :aria-label="
                count ? `Notifications (${count} unread)` : 'Notifications'
            "
        >
            <BellIcon />
            <Badge
                v-if="count"
                class="bg-destructive absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-white"
            >
                {{ label }}
            </Badge>
        </RouterLink>
    </Button>
</template>
