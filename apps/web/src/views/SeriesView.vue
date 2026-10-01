<script setup lang="ts">
import BackButton from '@/components/BackButton.vue';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import MediaDetails from '@/components/media/MediaDetails.vue';
import LogButton from '@/components/progress/LogButton.vue';
import StarRating from '@/components/progress/StarRating.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Spinner } from '@/components/shadcn-components/spinner';
import { usePageTitle } from '@/composables/usePageTitle';
import { useSeriesPage, useSeriesVolumes } from '@/composables/useSeries';
import {
    completedWord,
    kindStatusLabels,
    SERIES_KIND_LABELS,
} from '@/lib/media-types';
import { staggerIn } from '@/lib/motion';

import { computed } from 'vue';

const props = defineProps<{ id: string }>();

const { data: series, error: loadError } = useSeriesPage(() => props.id);
usePageTitle(() => series.value?.title);

const volumes = useSeriesVolumes(() => props.id);

const labels = computed(() =>
    series.value ? kindStatusLabels(series.value.kind) : null
);

const hasDetails = computed(
    () =>
        !!series.value &&
        (!!series.value.description ||
            series.value.genres.length > 0 ||
            series.value.facts.length > 0)
);
</script>

<template>
    <div class="flex flex-col gap-4">
        <div>
            <BackButton :to="{ name: 'collections' }" text="Back to shelves" />
        </div>

        <FormError :message="loadError?.message ?? null" />

        <div v-if="!series && !loadError" class="flex justify-center p-4">
            <Spinner class="size-6" />
        </div>

        <div
            v-if="series && labels"
            class="motion-safe:animate-in fade-in animation-duration-500 flex gap-4"
        >
            <CoverImage
                size="md"
                :src="series.coverUrl"
                :alt="series.title"
                class="h-36 w-24 shrink-0"
            />
            <div class="grid flex-1 content-start gap-1.5">
                <h1 class="text-lg font-semibold">{{ series.title }}</h1>
                <div class="flex items-center gap-1.5">
                    <Badge variant="secondary">
                        {{ SERIES_KIND_LABELS[series.kind] }}
                    </Badge>
                    <span class="text-muted-foreground text-xs">
                        {{ series.ownedCount }} of
                        {{ series.volumeCount ?? series.itemCount }} owned ·
                        {{ series.completedCount }}
                        {{ completedWord(labels) }}
                    </span>
                </div>
            </div>
        </div>
        <MediaDetails
            v-if="series && hasDetails"
            class="motion-safe:animate-in fade-in animation-duration-500 max-w-3xl"
            :description="series.description"
            :genres="series.genres"
            :facts="series.facts"
        />

        <PagedList :list="volumes" empty-text="Nothing in this series yet.">
            <template #default="{ items }">
                <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    <li
                        v-for="(item, index) in items"
                        v-bind="staggerIn(index)"
                        :key="item.id"
                        class="grid content-start gap-1.5"
                    >
                        <RouterLink
                            :to="{ name: 'item', params: { id: item.id } }"
                            class="group grid gap-1"
                        >
                            <CoverImage
                                size="md"
                                :src="item.coverUrl"
                                :alt="item.title"
                                class="aspect-2/3 w-full transition duration-200 ease-out group-hover:-translate-y-1 group-hover:shadow-md"
                            />
                            <div class="flex items-center gap-1">
                                <p class="text-xs font-medium">
                                    Vol. {{ item.position ?? '?' }}
                                </p>
                                <Badge v-if="item.owned" variant="secondary">
                                    Owned
                                </Badge>
                            </div>
                            <p
                                class="text-muted-foreground line-clamp-2 min-h-8 text-xs"
                            >
                                {{ item.title }}
                            </p>
                            <!-- Keeps its height when empty, so every
                                 Log button lines up. -->
                            <div class="flex h-5 items-center">
                                <StarRating
                                    v-if="item.rating !== null"
                                    readonly
                                    small
                                    :model-value="item.rating"
                                />
                            </div>
                        </RouterLink>
                        <LogButton
                            v-if="labels"
                            block
                            :catalog-item-id="item.id"
                            :title="item.title"
                            :status="item.status"
                            :labels="labels"
                        />
                    </li>
                </ul>
            </template>
        </PagedList>
    </div>
</template>
