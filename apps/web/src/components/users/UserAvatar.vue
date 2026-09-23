<script setup lang="ts">
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    type AvatarVariants,
} from '@/components/shadcn-components/avatar';

import { computed, type HTMLAttributes } from 'vue';

const props = defineProps<{
    name: string;
    image?: string | null;
    size?: AvatarVariants['size'];
    class?: HTMLAttributes['class'];
}>();

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
        <AvatarImage v-if="image" :src="image" :alt="name" />
        <AvatarFallback>{{ initials }}</AvatarFallback>
    </Avatar>
</template>
