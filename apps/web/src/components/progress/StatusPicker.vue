<script setup lang="ts">
import { ProgressStatus } from '@analog/types';
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/shadcn-components/toggle-group';
import { PROGRESS_STATUSES, type StatusLabels } from '@/lib/media-types';

import { z } from 'zod';

defineProps<{ labels: StatusLabels; disabled?: boolean }>();

const status = defineModel<ProgressStatus | null>({ required: true });

const StatusSchema = z.enum(ProgressStatus);

// Clicking the selected status again clears it.
function onChange(value: unknown) {
    const parsed = StatusSchema.safeParse(value);
    status.value = parsed.success ? parsed.data : null;
}
</script>

<template>
    <ToggleGroup
        type="single"
        variant="outline"
        size="lg"
        :model-value="status ?? undefined"
        :disabled="disabled"
        class="w-full"
        @update:model-value="onChange"
    >
        <ToggleGroupItem
            v-for="value in PROGRESS_STATUSES"
            :key="value"
            :value="value"
            class="flex-1"
        >
            {{ labels[value] }}
        </ToggleGroupItem>
    </ToggleGroup>
</template>
