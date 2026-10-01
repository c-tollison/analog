<script setup lang="ts">
import { SERIES_VOLUME_FILTERS, type SeriesVolumeFilter } from '@analog/types';
import BackButton from '@/components/BackButton.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import CoverImage from '@/components/CoverImage.vue';
import CollectionProgressBar from '@/components/collections/CollectionProgressBar.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import MediaDetails from '@/components/media/MediaDetails.vue';
import CoverRating from '@/components/progress/CoverRating.vue';
import LogButton from '@/components/progress/LogButton.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/shadcn-components/toggle-group';
import {
    useCollection,
    useRemoveCollectionItem,
} from '@/composables/useCollections';
import { usePageTitle } from '@/composables/usePageTitle';
import { useQueryParam } from '@/composables/useQueryParam';
import { useSeriesPage, useSeriesVolumes } from '@/composables/useSeries';
import {
    completedWord,
    kindStatusLabels,
    SERIES_KIND_LABELS,
} from '@/lib/media-types';
import { staggerIn } from '@/lib/motion';
import { missingVolumes } from '@/lib/volumes';
import { useSearchStore } from '@/stores/search';

import { XIcon } from '@lucide/vue';
import { computed, ref } from 'vue';
import { type RouteLocationRaw, useRoute } from 'vue-router';

const props = defineProps<{ id: string }>();

const route = useRoute();
const search = useSearchStore();

// Opened from one of your shelves. Owned then means on that shelf, and its
// volumes can be taken off it here.
const shelfId = computed(() =>
    typeof route.query.shelf === 'string' ? route.query.shelf : null
);
const { data: shelf } = useCollection(() => shelfId.value ?? '', {
    enabled: () => shelfId.value !== null,
});
const isMember = computed(() => !!shelf.value?.role);

const { data: series, error: loadError } = useSeriesPage(
    () => props.id,
    shelfId
);
usePageTitle(() => series.value?.title);

function isFilter(value: unknown): value is SeriesVolumeFilter {
    return SERIES_VOLUME_FILTERS.some((filter) => filter === value);
}

// From a shelf you see what you own; from anywhere else, everything. The
// choice lives in the URL so going back keeps it.
const show = useQueryParam('show', SERIES_VOLUME_FILTERS, () =>
    shelfId.value ? 'owned' : 'all'
);

function onShow(value: unknown) {
    if (isFilter(value)) show.value = value;
}

const volumes = useSeriesVolumes(() => props.id, show, shelfId);

const {
    mutate: removeItem,
    isPending: isRemoving,
    error: removeError,
} = useRemoveCollectionItem();

const removing = ref<{ id: string; title: string } | null>(null);
const confirmingRemove = computed({
    get: () => removing.value !== null,
    set: (open) => {
        if (!open) removing.value = null;
    },
});

function onRemove() {
    if (!removing.value || !shelfId.value) return;
    removeItem(
        { collectionId: shelfId.value, itemId: removing.value.id },
        { onSettled: () => (removing.value = null) }
    );
}

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

const emptyText = computed<Record<SeriesVolumeFilter, string>>(() => ({
    owned: shelf.value
        ? `None of these are on ${shelf.value.name} yet.`
        : "You don't own any of these yet.",
    missing: shelf.value
        ? `Every volume is on ${shelf.value.name}.`
        : 'You own every volume here.',
    all: 'Nothing in this series yet.',
}));

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

        <FormError :message="(loadError ?? removeError)?.message ?? null" />

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
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
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
                <p v-if="shelf" class="text-muted-foreground text-xs">
                    {{ series.ownedCount }} owned on
                    <span class="text-foreground font-medium">
                        {{ shelf.name }}
                    </span>
                </p>
            </div>
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

        <ConfirmDialog
            v-model:open="confirmingRemove"
            :title="`Remove ${removing?.title ?? 'item'}?`"
            :description="`It'll be taken off ${shelf?.name ?? 'this shelf'}.`"
            confirm-text="Remove"
            :pending="isRemoving"
            @confirm="onRemove"
        />

        <PagedList :list="volumes" :empty-text="emptyText[show]">
            <template #default="{ items }">
                <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    <li
                        v-for="(item, index) in items"
                        v-bind="staggerIn(index)"
                        :key="item.id"
                        class="group/volume relative grid grid-cols-1 content-start gap-1.5"
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
                            >
                                <CoverRating
                                    v-if="item.rating !== null"
                                    :rating="item.rating"
                                />
                            </CoverImage>
                            <div class="flex items-center gap-1">
                                <p class="text-xs font-medium">
                                    Vol. {{ item.position ?? '?' }}
                                </p>
                                <Badge
                                    v-if="show === 'all' && !item.owned"
                                    variant="destructive"
                                >
                                    Missing
                                </Badge>
                            </div>
                            <p
                                class="text-muted-foreground line-clamp-2 min-h-8 text-xs"
                            >
                                {{ item.title }}
                            </p>
                        </RouterLink>
                        <Button
                            v-if="isMember && item.shelfItemId"
                            variant="secondary"
                            size="icon"
                            class="absolute top-1 right-1 sm:opacity-0 sm:group-hover/volume:opacity-100 sm:focus-visible:opacity-100"
                            :aria-label="`Remove ${item.title}`"
                            @click="
                                removing = {
                                    id: item.shelfItemId,
                                    title: item.title,
                                }
                            "
                        >
                            <XIcon />
                        </Button>
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
