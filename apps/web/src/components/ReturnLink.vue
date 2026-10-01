<script setup lang="ts">
import { goBackTo } from '@/lib/navigation';

import { type RouteLocationRaw, useLink, useRouter } from 'vue-router';

// A link that goes back when its page is already behind the person, so
// looping between pages doesn't pile up history.
const props = defineProps<{ to: RouteLocationRaw }>();

const router = useRouter();
const { href, navigate } = useLink(props);

function onClick(event: MouseEvent) {
    const isPlainClick =
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey;
    if (isPlainClick && goBackTo(router, props.to)) {
        event.preventDefault();
        return;
    }
    navigate(event);
}
</script>

<template>
    <a :href="href" @click="onClick"><slot /></a>
</template>
