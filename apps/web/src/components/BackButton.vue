<script setup lang="ts">
import { Button } from '@/components/shadcn-components/button';

import { ArrowLeftIcon } from '@lucide/vue';
import { computed } from 'vue';
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router';

// Goes back to the previous page in the app. Falls back to `to` when the
// page was opened directly or the previous page was outside the app shell.
const props = defineProps<{ to: RouteLocationRaw; text: string }>();

const router = useRouter();
const route = useRoute();

const previous = computed(() => {
    // Re-read the history entry on every navigation.
    void route.fullPath;
    const back = window.history.state?.back;
    if (typeof back !== 'string') return null;
    const resolved = router.resolve(back);
    return resolved.matched.some((r) => r.meta.requiresAuth) ? resolved : null;
});

const label = computed(() => {
    if (!previous.value) return props.text;
    return previous.value.path === router.resolve(props.to).path
        ? props.text
        : 'Back';
});
</script>

<template>
    <Button v-if="previous" variant="ghost" size="sm" @click="router.back()">
        <ArrowLeftIcon />
        {{ label }}
    </Button>
    <Button v-else variant="ghost" size="sm" as-child>
        <RouterLink :to="to">
            <ArrowLeftIcon />
            {{ label }}
        </RouterLink>
    </Button>
</template>
