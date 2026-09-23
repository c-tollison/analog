<script setup lang="ts">
import { Button } from '@/components/shadcn-components/button';

import { BellIcon } from '@lucide/vue';
import { computed } from 'vue';

// TODO: true when there are pending collection invites or friend requests.
const hasNotifications = computed(() => false);
</script>

<template>
    <Button
        variant="ghost"
        size="icon-lg"
        :class="hasNotifications ? 'text-destructive' : 'text-muted-foreground'"
        as-child
    >
        <RouterLink
            :to="{ name: 'notifications' }"
            :aria-label="
                hasNotifications ? 'Notifications (unread)' : 'Notifications'
            "
        >
            <BellIcon />
        </RouterLink>
    </Button>
</template>
