<script setup lang="ts">
import { LogRange, MediaFormat, ProgressStatus } from '@analog/types';
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/shadcn-components/card';
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/shadcn-components/toggle-group';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/shadcn-components/tooltip';
import type { LogStats } from '@/composables/useLog';
import { formatStatusLabels } from '@/lib/media-types';

import { StarIcon } from '@lucide/vue';
import { computed } from 'vue';
import { z } from 'zod';

const props = defineProps<{ stats: LogStats }>();

const range = defineModel<LogRange>('range', { required: true });

const RangeSchema = z.enum(LogRange);

// Clicking the picked range again unpicks it, so keep the old one.
function onRange(value: unknown) {
    const parsed = RangeSchema.safeParse(value);
    if (parsed.success) range.value = parsed.data;
}

// How each range is labelled and drawn. `step` labels every nth bar,
// counting back from today.
const RANGES = {
    [LogRange.ThirtyDays]: {
        label: '30 days',
        unit: 'day',
        name: { month: 'short', day: 'numeric' },
        axis: { month: 'short', day: 'numeric' },
        step: () => 7,
    },
    [LogRange.TwelveMonths]: {
        label: '12 months',
        unit: 'month',
        name: { month: 'short', year: 'numeric' },
        axis: { month: 'narrow' },
        step: () => 1,
    },
    [LogRange.AllTime]: {
        label: 'All time',
        unit: 'year',
        name: { year: 'numeric' },
        axis: { year: 'numeric' },
        step: (bars: number) => Math.ceil(bars / 6),
    },
} satisfies Record<
    LogRange,
    {
        label: string;
        unit: string;
        name: Intl.DateTimeFormatOptions;
        axis: Intl.DateTimeFormatOptions;
        step: (bars: number) => number;
    }
>;

// Books are the only media so far, so the counts use their words.
const labels = formatStatusLabels(MediaFormat.Book);
const readWord = labels[ProgressStatus.Completed].toLowerCase();

// Out of 5 stars, like the rating picker.
const averageStars = computed(() =>
    props.stats.ratingAverage !== null
        ? (props.stats.ratingAverage / 2).toFixed(1)
        : null
);

const shown = computed(() => RANGES[props.stats.range]);

// Bars are sized against the busiest one. A bar with none shows nothing.
const bars = computed(() => {
    const { perBar } = props.stats;
    const most = Math.max(1, ...perBar.map((bar) => bar.count));
    const step = shown.value.step(perBar.length);
    const nameFormat = new Intl.DateTimeFormat(undefined, shown.value.name);
    const axisFormat = new Intl.DateTimeFormat(undefined, shown.value.axis);
    return perBar.map((bar, index) => {
        // Bars rise one after another, all within a third of a second.
        const delay = `${Math.round((index / perBar.length) * 300)}ms`;
        // Keys look like 2026-10-01, 2026-10 or 2026.
        const [year = 0, month = 1, day = 1] = bar.key.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const isLabelled = (perBar.length - 1 - index) % step === 0;
        return {
            key: bar.key,
            count: bar.count,
            name: nameFormat.format(date),
            axis: isLabelled ? axisFormat.format(date) : '',
            height: `${(bar.count / most) * 100}%`,
            delay,
        };
    });
});
</script>

<template>
    <Card>
        <CardHeader>
            <CardTitle>Stats</CardTitle>
            <CardAction>
                <ToggleGroup
                    type="single"
                    variant="outline"
                    :model-value="range"
                    @update:model-value="onRange"
                >
                    <ToggleGroupItem
                        v-for="(option, value) in RANGES"
                        :key="value"
                        :value="value"
                    >
                        {{ option.label }}
                    </ToggleGroupItem>
                </ToggleGroup>
            </CardAction>
        </CardHeader>
        <CardContent class="grid gap-4">
            <dl class="flex gap-8">
                <div class="grid">
                    <dt class="text-muted-foreground order-2 text-xs">
                        {{ readWord }}
                    </dt>
                    <dd class="text-xl font-semibold tabular-nums">
                        {{ stats.read }}
                    </dd>
                </div>
                <div class="grid">
                    <dt class="text-muted-foreground order-2 text-xs">
                        avg rating
                    </dt>
                    <dd
                        class="flex items-center gap-1 text-xl font-semibold tabular-nums"
                    >
                        <template v-if="averageStars">
                            {{ averageStars }}
                            <StarIcon class="size-4" />
                        </template>
                        <template v-else>–</template>
                    </dd>
                </div>
            </dl>

            <div class="grid gap-1" aria-hidden="true">
                <div
                    class="flex h-20 items-end justify-center gap-0.5 border-b"
                >
                    <template v-for="bar in bars" :key="bar.key">
                        <!-- Only bars with finishes have something to hover. -->
                        <Tooltip v-if="bar.count">
                            <TooltipTrigger as-child>
                                <div
                                    class="flex h-full max-w-10 flex-1 items-end overflow-hidden"
                                >
                                    <div
                                        class="bg-primary motion-safe:animate-in slide-in-from-bottom-full animation-duration-700 fill-mode-backwards w-full rounded-t transition-[height] duration-500 ease-out"
                                        :style="{
                                            height: bar.height,
                                            animationDelay: bar.delay,
                                        }"
                                    />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                {{ bar.name }}: {{ bar.count }}
                                {{ readWord }}
                            </TooltipContent>
                        </Tooltip>
                        <div v-else class="max-w-10 flex-1" />
                    </template>
                </div>
                <!-- Labels can be wider than their bar, so they center on it
                     and spill over the unlabelled ones beside it. -->
                <div class="flex justify-center gap-0.5">
                    <span
                        v-for="bar in bars"
                        :key="bar.key"
                        class="text-muted-foreground flex max-w-10 flex-1 justify-center text-xs whitespace-nowrap"
                    >
                        {{ bar.axis }}
                    </span>
                </div>
            </div>
            <table class="sr-only">
                <caption>
                    {{ readWord }}
                    each
                    {{ shown.unit }}
                </caption>
                <tbody>
                    <tr v-for="bar in bars" :key="bar.key">
                        <th scope="row">{{ bar.name }}</th>
                        <td>{{ bar.count }}</td>
                    </tr>
                </tbody>
            </table>
        </CardContent>
    </Card>
</template>
