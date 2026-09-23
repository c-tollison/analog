<script setup lang="ts">
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '@/components/shadcn-components/input-group';

import { SearchIcon } from '@lucide/vue';

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
            :placeholder="placeholder"
            :aria-label="placeholder ?? 'Search'"
        />
    </InputGroup>
</template>
