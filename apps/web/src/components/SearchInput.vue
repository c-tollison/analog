<script setup lang="ts">
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from '@/components/shadcn-components/input-group';
import { vNoAutofill } from '@/lib/no-autofill';

import { SearchIcon, XIcon } from '@lucide/vue';

defineProps<{ placeholder?: string }>();

const model = defineModel<string>({ required: true });
</script>

<template>
    <InputGroup>
        <InputGroupAddon>
            <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
            v-model="model"
            type="search"
            v-no-autofill
            :placeholder="placeholder"
            :aria-label="placeholder ?? 'Search'"
        />
        <InputGroupAddon v-if="model" align="inline-end">
            <InputGroupButton
                size="icon-xs"
                aria-label="Clear search"
                @click="model = ''"
            >
                <XIcon />
            </InputGroupButton>
        </InputGroupAddon>
    </InputGroup>
</template>
