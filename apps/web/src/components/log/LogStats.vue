<script setup lang="ts">
import { MediaFormat, ProgressStatus } from '@analog/types';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/shadcn-components/card';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/shadcn-components/tooltip';
import type { LogStats } from '@/composables/useLog';
import { formatStatusLabels } from '@/lib/media-types';

import { StarIcon } from '@lucide/vue';
import { computed } from 'vue';

const props = defineProps<{ stats: LogStats }>();

// Books are the only media so far, so the counts use their words.
const labels = formatStatusLabels(MediaFormat.Book);
const readWord = labels[ProgressStatus.Completed].toLowerCase();

const tiles = computed(() => [
    {
        value: props.stats.readThisYear,
        label: `${readWord} in ${props.stats.year}`,
    },
    { value: props.stats.readAllTime, label: `${readWord} all time` },
    {
        value: props.stats.reading,
        label: labels[ProgressStatus.InProgress].toLowerCase(),
    },
    {
        value: props.stats.wantToRead,
        label: labels[ProgressStatus.Planned].toLowerCase(),
    },
]);

// Out of 5 stars, like the rating picker.
const averageStars = computed(() =>
    props.stats.ratingAverage !== null
        ? (props.stats.ratingAverage / 2).toFixed(1)
        : null
);

const shortMonth = new Intl.DateTimeFormat(undefined, { month: 'short' });
const narrowMonth = new Intl.DateTimeFormat(undefined, { month: 'narrow' });

// Bars are sized against the busiest month. A month with none shows no bar.
const months = computed(() => {
    const most = Math.max(1, ...props.stats.perMonth);
    return props.stats.perMonth.map((count, index) => {
        const date = new Date(props.stats.year, index, 1);
        return {
            count,
            name: shortMonth.format(date),
            initial: narrowMonth.format(date),
            height: `${(count / most) * 100}%`,
        };
    });
});
</script>

<template>
    <Card>
        <CardHeader>
            <CardTitle>{{ stats.year }}</CardTitle>
        </CardHeader>
        <CardContent class="grid gap-4">
            <dl class="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div v-for="tile in tiles" :key="tile.label" class="grid">
                    <dt class="text-muted-foreground order-2 text-xs">
                        {{ tile.label }}
                    </dt>
                    <dd class="text-xl font-semibold tabular-nums">
                        {{ tile.value }}
                    </dd>
                </div>
                <div class="grid">
                    <dt class="text-muted-foreground order-2 text-xs">
                        average rating
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
                <div class="flex h-20 items-end gap-0.5 border-b">
                    <template v-for="month in months" :key="month.name">
                        <!-- Only months with finishes have a bar to hover. -->
                        <Tooltip v-if="month.count">
                            <TooltipTrigger as-child>
                                <div class="flex h-full flex-1 items-end">
                                    <div
                                        class="bg-primary w-full rounded-t"
                                        :style="{ height: month.height }"
                                    />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                {{ month.name }}: {{ month.count }}
                                {{ readWord }}
                            </TooltipContent>
                        </Tooltip>
                        <div v-else class="flex-1" />
                    </template>
                </div>
                <div class="flex gap-0.5">
                    <span
                        v-for="month in months"
                        :key="month.name"
                        class="text-muted-foreground flex-1 text-center text-xs"
                    >
                        {{ month.initial }}
                    </span>
                </div>
            </div>
            <table class="sr-only">
                <caption>
                    {{ readWord }}
                    each month in
                    {{ stats.year }}
                </caption>
                <tbody>
                    <tr v-for="month in months" :key="month.name">
                        <th scope="row">{{ month.name }}</th>
                        <td>{{ month.count }}</td>
                    </tr>
                </tbody>
            </table>
        </CardContent>
    </Card>
</template>
