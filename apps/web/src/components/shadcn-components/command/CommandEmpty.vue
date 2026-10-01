<script setup lang="ts">
import { cn } from '@/lib/utils';

import { useCommand } from '.';
import { reactiveOmit } from '@vueuse/core';
import type { PrimitiveProps } from 'reka-ui';
import { Primitive } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { computed } from 'vue';

const props = defineProps<
    PrimitiveProps & { class?: HTMLAttributes['class'] }
>();

const delegatedProps = reactiveOmit(props, 'class');

const { filterState, shouldFilter } = useCommand();
const isRender = computed(
    () =>
        shouldFilter.value &&
        !!filterState.search &&
        filterState.filtered.count === 0
);
</script>

<template>
    <Primitive
        v-if="isRender"
        data-slot="command-empty"
        v-bind="delegatedProps"
        :class="cn('py-6 text-center text-xs/relaxed', props.class)"
    >
        <slot />
    </Primitive>
</template>
