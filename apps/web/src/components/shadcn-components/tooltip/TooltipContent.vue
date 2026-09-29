<script setup lang="ts">
import { cn } from '@/lib/utils';

import type { TooltipVariants } from '.';
import { tooltipArrowVariants, tooltipVariants } from '.';
import { reactiveOmit } from '@vueuse/core';
import type { TooltipContentEmits, TooltipContentProps } from 'reka-ui';
import {
    TooltipArrow,
    TooltipContent,
    TooltipPortal,
    useForwardPropsEmits,
} from 'reka-ui';
import type { HTMLAttributes } from 'vue';

defineOptions({
    inheritAttrs: false,
});

const props = withDefaults(
    defineProps<
        TooltipContentProps & {
            variant?: TooltipVariants['variant'];
            class?: HTMLAttributes['class'];
        }
    >(),
    {
        sideOffset: 0,
    }
);

const emits = defineEmits<TooltipContentEmits>();

const delegatedProps = reactiveOmit(props, 'class', 'variant');
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
    <TooltipPortal>
        <TooltipContent
            data-slot="tooltip-content"
            v-bind="{ ...forwarded, ...$attrs }"
            :class="cn('data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=instant-open]:animate-in data-[state=instant-open]:fade-in-0 data-[state=instant-open]:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs has-data-[slot=kbd]:pr-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm z-50 w-fit max-w-xs origin-(--reka-tooltip-content-transform-origin)', tooltipVariants({ variant }), props.class)"
        >
            <slot />

            <TooltipArrow :class="tooltipArrowVariants({ variant })" />
        </TooltipContent>
    </TooltipPortal>
</template>
