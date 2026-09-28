<script lang="ts" setup>
import { cn } from '@/lib/utils';

import { reactiveOmit } from '@vueuse/core';
import type { DrawerOverlayProps } from 'reka-ui';
import { DrawerOverlay } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

const props = defineProps<
    DrawerOverlayProps & { class?: HTMLAttributes['class'] }
>();

const delegatedProps = reactiveOmit(props, 'class');
</script>

<template>
    <DrawerOverlay
        data-slot="drawer-overlay"
        v-bind="delegatedProps"
        :class="cn('data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/80 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-50', props.class)"
    />
</template>
