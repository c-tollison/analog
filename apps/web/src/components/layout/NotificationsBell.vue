<script setup lang="ts">
import { Button } from '@/components/shadcn-components/button';
import { useNotificationCount } from '@/composables/useNotifications';

import NotificationCountBadge from './NotificationCountBadge.vue';
import { BellIcon } from '@lucide/vue';
import { computed } from 'vue';

const { data } = useNotificationCount();
const count = computed(() => data.value?.count ?? 0);
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
            <NotificationCountBadge class="-top-0.5 -right-0.5" />
        </RouterLink>
    </Button>
</template>
