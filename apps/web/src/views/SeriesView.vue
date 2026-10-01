<script setup lang="ts">
import { SERIES_VOLUME_FILTERS, type SeriesVolumeFilter } from '@analog/types';
import BackButton from '@/components/BackButton.vue';
import CoverImage from '@/components/CoverImage.vue';
import CollectionProgressBar from '@/components/collections/CollectionProgressBar.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import MediaDetails from '@/components/media/MediaDetails.vue';
import LogButton from '@/components/progress/LogButton.vue';
import StarRating from '@/components/progress/StarRating.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/shadcn-components/toggle-group';
import { useCollection } from '@/composables/useCollections';
import { usePageTitle } from '@/composables/usePageTitle';
import { useSeriesPage, useSeriesVolumes } from '@/composables/useSeries';
import {
    completedWord,
    kindStatusLabels,
    SERIES_KIND_LABELS,
} from '@/lib/media-types';
import { staggerIn } from '@/lib/motion';
import { missingVolumes } from '@/lib/volumes';
import { useSearchStore } from '@/stores/search';

import { computed } from 'vue';
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router';

const props = defineProps<{ id: string }>();

const route = useRoute();
const router = useRouter();
const search = useSearchStore();

const { data: series, error: loadError } = useSeriesPage(() => props.id);
usePageTitle(() => series.value?.title);

// Opened from one of your shelves. It only changes where Back goes and which
// volumes show first.
const shelfId = computed(() =>
    typeof route.query.shelf === 'string' ? route.query.shelf : null
);
const { data: shelf } = useCollection(() => shelfId.value ?? '', {
    enabled: () => shelfId.value !== null,
});

function isFilter(value: unknown): value is SeriesVolumeFilter {
    return SERIES_VOLUME_FILTERS.some((filter) => filter === value);
}

// From a shelf you see what you own; from anywhere else, everything. The
// choice lives in the URL so going back keeps it.
const show = computed({
    get: (): SeriesVolumeFilter =>
        isFilter(route.query.show)
            ? route.query.show
            : shelfId.value
              ? 'owned'
              : 'all',
    set: (value) => {
        router.replace({ query: { ...route.query, show: value } });
    },
});

function onShow(value: unknown) {
    if (isFilter(value)) show.value = value;
}

const volumes = useSeriesVolumes(() => props.id, show);

const labels = computed(() =>
    series.value ? kindStatusLabels(series.value.kind) : null
);

// The series' size: its set volume count, or what the app has.
const total = computed(() =>
    series.value
        ? Math.max(series.value.volumeCount ?? 0, series.value.itemCount)
        : 0
);

const counts = computed<Record<SeriesVolumeFilter, number>>(() => ({
    owned: series.value?.ownedCount ?? 0,
    missing: (series.value?.itemCount ?? 0) - (series.value?.ownedCount ?? 0),
    all: series.value?.itemCount ?? 0,
}));

const FILTER_LABELS: Record<SeriesVolumeFilter, string> = {
    owned: 'Owned',
    missing: 'Missing',
    all: 'All',
};

const EMPTY_TEXT: Record<SeriesVolumeFilter, string> = {
    owned: "You don't own any of these yet.",
    missing: 'You own every volume here.',
    all: 'Nothing in this series yet.',
};

// Volume numbers the series has that no item in the app covers yet.
const notInApp = computed(() =>
    series.value?.volumeCount
        ? missingVolumes(series.value.positions, series.value.volumeCount)
        : null
);

const hasDetails = computed(
    () =>
        !!series.value &&
        (!!series.value.description ||
            series.value.genres.length > 0 ||
            series.value.facts.length > 0)
);

const back = computed<{ to: RouteLocationRaw; text: string }>(() =>
    shelfId.value
        ? {
              to: { name: 'collection', params: { id: shelfId.value } },
              text: shelf.value ? `Back to ${shelf.value.name}` : 'Back',
          }
        : { to: { name: 'collections' }, text: 'Back to shelves' }
);
</script>

<template>
    <div class="flex flex-col gap-4">
        <div>
            <BackButton :to="back.to" :text="back.text" />
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
                        {{ series.ownedCount }} of {{ total }} owned ·
                        {{ series.completedCount }}
                        {{ completedWord(labels) }}
                    </span>
                </div>
                <CollectionProgressBar
                    v-if="total"
                    class="pt-1 sm:max-w-sm"
                    :total="total"
                    :completed="series.completedCount"
                    :in-progress="series.inProgressCount"
                    :planned="series.plannedCount"
                    :labels="labels"
                />
            </div>
        </div>
        <MediaDetails
            v-if="series && hasDetails"
            class="motion-safe:animate-in fade-in animation-duration-500 max-w-3xl"
            :description="series.description"
            :genres="series.genres"
            :facts="series.facts"
        />

        <div
            v-if="series"
            class="motion-safe:animate-in fade-in animation-duration-500 flex flex-wrap items-center justify-between gap-2"
        >
            <ToggleGroup
                type="single"
                variant="outline"
                :model-value="show"
                @update:model-value="onShow"
            >
                <ToggleGroupItem
                    v-for="filter in SERIES_VOLUME_FILTERS"
                    :key="filter"
                    :value="filter"
                >
                    {{ FILTER_LABELS[filter] }} {{ counts[filter] }}
                </ToggleGroupItem>
            </ToggleGroup>
            <p
                v-if="notInApp"
                class="text-muted-foreground flex items-center gap-2 text-xs"
            >
                Not in Analog yet: {{ notInApp }}
                <Button variant="outline" size="sm" @click="search.openAdd()">
                    Add by ISBN
                </Button>
            </p>
        </div>

        <PagedList :list="volumes" :empty-text="EMPTY_TEXT[show]">
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
