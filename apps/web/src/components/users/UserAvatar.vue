<script setup lang="ts">
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    type AvatarVariants,
} from '@/components/shadcn-components/avatar';
import { API_URL } from '@/lib/env';

import { computed, type HTMLAttributes } from 'vue';

const props = defineProps<{
    name: string;
    image?: string | null;
    size?: AvatarVariants['size'];
    class?: HTMLAttributes['class'];
}>();

// Uploaded photos are stored as paths on the API.
const src = computed(() =>
    props.image ? new URL(props.image, API_URL).href : undefined
);

const initials = computed(() =>
    props.name
        .split(/[\s@.]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')
);
</script>

<template>
    <Avatar :size="size" :class="props.class">
        <AvatarImage v-if="src" :src="src" :alt="name" />
        <AvatarFallback>{{ initials }}</AvatarFallback>
        <slot />
    </Avatar>
</template>
