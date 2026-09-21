<script setup lang="ts">
import {
    InputGroup,
    InputGroupAddon,
} from '@/components/shadcn-components/input-group';
import { cn } from '@/lib/utils';

import { SearchIcon } from '@lucide/vue';
import { reactiveOmit } from '@vueuse/core';
import type { ComboboxInputEmits, ComboboxInputProps } from 'reka-ui';
import { ComboboxInput, useForwardPropsEmits } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<
    ComboboxInputProps & {
        class?: HTMLAttributes['class'];
    }
>();

const emits = defineEmits<ComboboxInputEmits>();

const delegatedProps = reactiveOmit(props, 'class');

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
    <InputGroup>
        <InputGroupAddon>
            <SearchIcon class="size-3.5 shrink-0 opacity-50" />
        </InputGroupAddon>
        <ComboboxInput
            data-slot="combobox-input"
            :class="cn('flex-1 outline-hidden disabled:cursor-not-allowed disabled:opacity-50', props.class)"
            v-bind="{ ...$attrs, ...forwarded }"
        />
    </InputGroup>
</template>
