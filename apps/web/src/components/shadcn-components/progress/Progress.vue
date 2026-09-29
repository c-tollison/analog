<script setup lang="ts">
import { cn } from '@/lib/utils';

import { reactiveOmit } from '@vueuse/core';
import type { ProgressRootProps } from 'reka-ui';
import { ProgressIndicator, ProgressRoot } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

const props = withDefaults(
    defineProps<ProgressRootProps & { class?: HTMLAttributes['class'] }>(),
    {
        modelValue: 0,
    }
);

const delegatedProps = reactiveOmit(props, 'class');
</script>

<template>
    <ProgressRoot
        data-slot="progress"
        v-bind="delegatedProps"
        :class="
      cn(
        'bg-muted h-1 rounded-md relative flex w-full items-center overflow-x-hidden',
        props.class,
      )
    "
    >
        <ProgressIndicator
            data-slot="progress-indicator"
            class="bg-primary size-full flex-1 transition-all duration-500 ease-out motion-safe:animate-in slide-in-from-left-full animation-duration-700"
            :style="`transform: translateX(-${100 - (props.modelValue ?? 0)}%);`"
        />
    </ProgressRoot>
</template>
