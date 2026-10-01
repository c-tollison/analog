<script setup lang="ts">
import { LogRange, MediaFormat, ProgressStatus } from '@analog/types';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import LogStats from '@/components/log/LogStats.vue';
import ReadingGoal from '@/components/log/ReadingGoal.vue';
import StarRating from '@/components/progress/StarRating.vue';
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemMedia,
    ItemTitle,
} from '@/components/shadcn-components/item';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/shadcn-components/tabs';
import {
    useDiary,
    useLogStats,
    useReading,
    useWantToRead,
} from '@/composables/useLog';
import { useQueryParam } from '@/composables/useQueryParam';
import { formatStatusLabels } from '@/lib/media-types';
import { staggerIn } from '@/lib/motion';

import { computed } from 'vue';
import { z } from 'zod';

const props = defineProps<{ username: string; isMe: boolean }>();

// Books are the only media so far, so the tabs use their words.
const labels = formatStatusLabels(MediaFormat.Book);

const StatusSchema = z.enum(ProgressStatus);
// "status" and not "tab", since the profile page uses "tab" for Log and
// Shelves.
const tab = useQueryParam(
    'status',
    Object.values(ProgressStatus),
    ProgressStatus.InProgress
);

function onTab(value: unknown) {
    const parsed = StatusSchema.safeParse(value);
    if (parsed.success) tab.value = parsed.data;
}

const range = useQueryParam(
    'range',
    Object.values(LogRange),
    LogRange.ThirtyDays
);
const { data: stats, error: statsError } = useLogStats(
    () => props.username,
    range
);

const reading = useReading(() => props.username, {
    enabled: () => tab.value === ProgressStatus.InProgress,
});
const planned = useWantToRead(() => props.username, {
    enabled: () => tab.value === ProgressStatus.Planned,
});
const diary = useDiary(() => props.username, {
    enabled: () => tab.value === ProgressStatus.Completed,
});

// A visitor can't add to someone else's Log, so "yet" is only for you.
const emptyText = computed(() =>
    props.isMe ? 'Nothing here yet.' : 'Nothing here.'
);

const dateFormat = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});
</script>

<template>
    <div class="flex flex-col gap-4">
        <FormError :message="statsError?.message ?? null" />
        <div v-if="!stats && !statsError" class="flex justify-center p-4">
            <Spinner class="size-6" />
        </div>
        <div
            v-if="stats"
            class="motion-safe:animate-in fade-in animation-duration-500 grid gap-4 sm:grid-cols-[2fr_1fr]"
        >
            <LogStats v-model:range="range" :stats="stats" />
            <ReadingGoal :stats="stats" :is-me="isMe" />
        </div>

        <Tabs :model-value="tab" class="gap-4" @update:model-value="onTab">
            <TabsList>
                <TabsTrigger :value="ProgressStatus.InProgress">
                    {{ labels[ProgressStatus.InProgress] }}
                </TabsTrigger>
                <TabsTrigger :value="ProgressStatus.Planned">
                    {{ labels[ProgressStatus.Planned] }}
                </TabsTrigger>
                <TabsTrigger :value="ProgressStatus.Completed">
                    {{ labels[ProgressStatus.Completed] }}
                </TabsTrigger>
            </TabsList>

            <TabsContent :value="ProgressStatus.InProgress">
                <PagedList :list="reading" :empty-text="emptyText">
                    <template #default="{ items }">
                        <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5">
                            <li
                                v-for="(entry, index) in items"
                                v-bind="staggerIn(index)"
                                :key="entry.id"
                                class="group"
                            >
                                <RouterLink
                                    :to="{ name: 'item', params: { id: entry.id } }"
                                    class="grid gap-1"
                                >
                                    <CoverImage
                                        size="md"
                                        :src="entry.coverUrl"
                                        :alt="entry.title"
                                        class="aspect-2/3 w-full transition duration-200 ease-out group-hover:-translate-y-1 group-hover:shadow-md"
                                    />
                                    <p
                                        class="line-clamp-2 min-h-8 text-xs font-medium"
                                    >
                                        {{ entry.title }}
                                    </p>
                                </RouterLink>
                            </li>
                        </ul>
                    </template>
                </PagedList>
            </TabsContent>

            <TabsContent :value="ProgressStatus.Planned">
                <PagedList :list="planned" :empty-text="emptyText">
                    <template #default="{ items }">
                        <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5">
                            <li
                                v-for="(entry, index) in items"
                                v-bind="staggerIn(index)"
                                :key="entry.series?.id ?? entry.id"
                                class="group"
                            >
                                <RouterLink
                                    :to="
                                    entry.series
                                        ? {
                                              name: 'series',
                                              params: { id: entry.series.id },
                                          }
                                        : {
                                              name: 'item',
                                              params: { id: entry.id },
                                          }
                                "
                                    class="grid gap-1"
                                >
                                    <CoverImage
                                        size="md"
                                        :src="entry.coverUrl"
                                        :alt="entry.series?.title ?? entry.title"
                                        class="aspect-2/3 w-full transition duration-200 ease-out group-hover:-translate-y-1 group-hover:shadow-md"
                                    />
                                    <p
                                        class="line-clamp-2 min-h-8 text-xs font-medium"
                                    >
                                        {{ entry.series?.title ?? entry.title }}
                                    </p>
                                    <p
                                        v-if="entry.series"
                                        class="text-muted-foreground text-xs"
                                    >
                                        {{ entry.count }}
                                        {{ entry.count === 1 ? 'volume' : 'volumes' }}
                                    </p>
                                </RouterLink>
                            </li>
                        </ul>
                    </template>
                </PagedList>
            </TabsContent>

            <TabsContent :value="ProgressStatus.Completed">
                <PagedList :list="diary" :empty-text="emptyText">
                    <template #default="{ items }">
                        <ItemGroup class="grid gap-2">
                            <Item
                                v-for="(entry, index) in items"
                                v-bind="staggerIn(index)"
                                :key="entry.id"
                                variant="outline"
                                size="sm"
                                as-child
                            >
                                <RouterLink
                                    :to="{ name: 'item', params: { id: entry.id } }"
                                >
                                    <ItemMedia>
                                        <CoverImage
                                            size="sm"
                                            :src="entry.coverUrl"
                                            :alt="entry.title"
                                            class="aspect-2/3 w-10"
                                        />
                                    </ItemMedia>
                                    <ItemContent class="min-w-0 gap-1">
                                        <ItemTitle class="line-clamp-1">
                                            {{ entry.title }}
                                        </ItemTitle>
                                        <ItemDescription>
                                            <template v-if="entry.completedAt">
                                                {{
                                                dateFormat.format(
                                                    new Date(entry.completedAt)
                                                )
                                                }}
                                            </template>
                                            <template v-if="entry.seriesTitle">
                                                · {{ entry.seriesTitle }}
                                            </template>
                                        </ItemDescription>
                                        <StarRating
                                            v-if="entry.rating !== null"
                                            readonly
                                            small
                                            :model-value="entry.rating"
                                        />
                                    </ItemContent>
                                </RouterLink>
                            </Item>
                        </ItemGroup>
                    </template>
                </PagedList>
            </TabsContent>
        </Tabs>
    </div>
</template>
