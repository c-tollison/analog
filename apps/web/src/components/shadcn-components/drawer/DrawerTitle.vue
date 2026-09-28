<script lang="ts" setup>
import { cn } from '@/lib/utils';

import { reactiveOmit } from '@vueuse/core';
import type { DrawerTitleProps } from 'reka-ui';
import { DrawerTitle } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

const props = defineProps<
    DrawerTitleProps & { class?: HTMLAttributes['class'] }
>();

const delegatedProps = reactiveOmit(props, 'class');
</script>

<template>
    <DrawerTitle
        data-slot="drawer-title"
        v-bind="delegatedProps"
        :class="cn('text-foreground text-sm font-medium cn-font-heading', props.class)"
    >
        <slot />
    </DrawerTitle>
</template>
