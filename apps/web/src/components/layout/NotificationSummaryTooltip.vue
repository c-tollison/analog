<script setup lang="ts">
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/shadcn-components/tooltip';
import { useNotificationCount } from '@/composables/useNotifications';

import { LibraryBigIcon, UserPlusIcon } from '@lucide/vue';
import { useMediaQuery, useTimeoutFn } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

// Pops up once when the app loads to say how many friend requests and
// collection invites are waiting. The top nav and the bottom nav each wrap
// their bell in one, and only the one on screen opens.
const props = defineProps<{
    side: 'top' | 'bottom';
    desktop: boolean;
}>();

const SHOW_MS = 5000;

const { data } = useNotificationCount();
const isDesktop = useMediaQuery('(min-width: 48rem)');
const route = useRoute();

const open = ref(false);
const { start } = useTimeoutFn(() => (open.value = false), SHOW_MS, {
    immediate: false,
});

const friendRequests = computed(() => data.value?.friendRequests ?? 0);
const collectionInvites = computed(() => data.value?.collectionInvites ?? 0);

let checked = false;
watch(
    data,
    (counts) => {
        if (checked || !counts) {
            return;
        }
        checked = true;
        if (
            counts.count &&
            isDesktop.value === props.desktop &&
            route.name !== 'notifications'
        ) {
            open.value = true;
            start();
        }
    },
    { immediate: true }
);

watch(
    () => route.fullPath,
    () => (open.value = false)
);

function onUpdateOpen(value: boolean) {
    if (!value) {
        open.value = false;
    }
}
</script>

<template>
    <Tooltip :open="open" @update:open="onUpdateOpen">
        <TooltipTrigger as-child>
            <slot />
        </TooltipTrigger>
        <TooltipContent
            :side="side"
            :side-offset="6"
            variant="primary"
            class="gap-3 text-sm font-medium"
        >
            <span v-if="friendRequests" class="flex items-center gap-1">
                <UserPlusIcon class="size-4" />
                {{ friendRequests }}
                <span class="sr-only">
                    friend {{ friendRequests === 1 ? 'request' : 'requests' }}
                </span>
            </span>
            <span v-if="collectionInvites" class="flex items-center gap-1">
                <LibraryBigIcon class="size-4" />
                {{ collectionInvites }}
                <span class="sr-only">
                    collection
                    {{ collectionInvites === 1 ? 'invite' : 'invites' }}
                </span>
            </span>
        </TooltipContent>
    </Tooltip>
</template>
