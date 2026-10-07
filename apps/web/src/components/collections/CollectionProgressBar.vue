<script setup lang="ts">
import { ProgressStatus } from '@analog/types';
import { STATUS_LABELS } from '@/lib/book-labels';

import { computed } from 'vue';

const props = defineProps<{
    total: number;
    completed: number;
    inProgress: number;
    planned: number;
}>();

const segments = computed(() =>
    [
        {
            key: 'completed',
            count: props.completed,
            label: STATUS_LABELS[ProgressStatus.Completed],
            class: 'bg-status-completed',
        },
        {
            key: 'in-progress',
            count: props.inProgress,
            label: STATUS_LABELS[ProgressStatus.InProgress],
            class: 'bg-status-in-progress',
        },
        {
            key: 'planned',
            count: props.planned,
            label: STATUS_LABELS[ProgressStatus.Planned],
            class: 'bg-status-planned',
        },
        {
            key: 'none',
            count:
                props.total -
                props.completed -
                props.inProgress -
                props.planned,
            label: 'Not started',
            class: 'bg-status-none',
        },
    ].filter((segment) => segment.count > 0)
);
</script>

<!-- The legend spells out each segment, so the bar itself is hidden from
     screen readers. -->
<template>
    <div class="flex flex-col gap-1.5">
        <div
            aria-hidden="true"
            class="h-1.5 w-full overflow-hidden rounded-full"
        >
            <div
                class="motion-safe:animate-in slide-in-from-left-full animation-duration-700 flex size-full ease-out"
            >
                <div
                    v-for="segment in segments"
                    :key="segment.key"
                    class="min-w-1 basis-0 transition-[flex-grow] duration-500 ease-out"
                    :class="segment.class"
                    :style="{ flexGrow: segment.count }"
                />
            </div>
        </div>
        <ul
            class="text-muted-foreground flex min-h-4 flex-wrap gap-x-3 gap-y-0.5 text-xs"
        >
            <li
                v-for="segment in segments"
                :key="segment.key"
                class="flex items-center gap-1"
            >
                <span
                    aria-hidden="true"
                    class="size-2 rounded-full"
                    :class="segment.class"
                />
                {{ segment.count }} {{ segment.label.toLowerCase() }}
            </li>
        </ul>
    </div>
</template>
