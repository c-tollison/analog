<script setup lang="ts">
import BackButton from '@/components/BackButton.vue';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import MediaDetails from '@/components/media/MediaDetails.vue';
import ProgressMark from '@/components/progress/ProgressMark.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Progress } from '@/components/shadcn-components/progress';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    useCollection,
    useCollectionSeries,
    useCollectionSeriesItems,
} from '@/composables/useCollections';
import { usePageTitle } from '@/composables/usePageTitle';
import {
    completedWord,
    kindStatusLabels,
    SERIES_KIND_LABELS,
} from '@/lib/media-types';
import { staggerIn } from '@/lib/motion';
import { missingVolumes } from '@/lib/volumes';

import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps<{ id: string; seriesId: string }>();

const { data: detail, error: detailError } = useCollectionSeries(
    () => props.id,
    () => props.seriesId
);
usePageTitle(() => detail.value?.series.title);

const { data: collection, error: collectionError } = useCollection(
    () => props.id
);
// This page is a read-only look at someone else's shelf. Members manage the
// series on its own page instead.
const router = useRouter();
watch(
    () => collection.value?.role,
    (role) => {
        if (role) {
            void router.replace({
                name: 'series',
                params: { id: props.seriesId },
                query: { shelf: props.id },
            });
        }
    },
    { immediate: true }
);

// A visitor sees the owner's progress, so say whose it is.
const progressOwner = computed(() =>
    collection.value?.role === null ? collection.value.ownerName : null
);

const volumes = useCollectionSeriesItems(
    () => props.id,
    () => props.seriesId
);

const labels = computed(() =>
    detail.value ? kindStatusLabels(detail.value.series.kind) : null
);

const percent = computed(() =>
    detail.value?.ownedCount
        ? Math.round(
              (detail.value.completedCount / detail.value.ownedCount) * 100
          )
        : 0
);

const hasDetails = computed(
    () =>
        !!detail.value &&
        (!!detail.value.description ||
            detail.value.genres.length > 0 ||
            detail.value.facts.length > 0)
);

const missing = computed(() => {
    const total = detail.value?.volumeCount;
    return detail.value && total
        ? missingVolumes(detail.value.ownedPositions, total)
        : null;
});

const headerError = computed(
    () => (detailError.value ?? collectionError.value)?.message ?? null
);
</script>

<template>
    <div class="flex flex-col gap-4">
        <div>
            <BackButton
                :to="{ name: 'collection', params: { id } }"
                :text="
                    collection ? `Back to ${collection.name}` : 'Back to shelf'
                "
            />
        </div>

        <div
            v-if="detail && labels"
            class="motion-safe:animate-in fade-in animation-duration-500 flex gap-4"
        >
            <CoverImage
                size="md"
                :src="detail.series.coverUrl"
                :alt="detail.series.title"
                class="h-36 w-24 shrink-0"
            />
            <div class="grid flex-1 content-start gap-1.5">
                <h1 class="text-lg font-semibold">
                    {{ detail.series.title }}
                </h1>
                <div class="flex items-center gap-1.5">
                    <Badge variant="secondary">
                        {{ SERIES_KIND_LABELS[detail.series.kind] }}
                    </Badge>
                    <span class="text-muted-foreground text-xs">
                        <template v-if="detail.volumeCount">
                            {{ detail.ownedCount }} of
                            {{ detail.volumeCount }} owned
                        </template>
                        <template v-else>
                            {{ detail.ownedCount }} owned
                        </template>
                    </span>
                </div>
                <p v-if="missing" class="text-muted-foreground text-xs">
                    Missing {{ missing }}
                </p>
                <div
                    v-if="detail.ownedCount"
                    class="grid gap-1.5 pt-1 sm:max-w-sm"
                >
                    <div class="flex justify-between text-xs">
                        <span>
                            <template v-if="progressOwner">
                                {{ progressOwner }} ·
                            </template>
                            {{ detail.completedCount }} of
                            {{ detail.ownedCount }}
                            {{ completedWord(labels) }}
                        </span>
                        <span class="text-muted-foreground">
                            {{ percent }}%
                        </span>
                    </div>
                    <Progress :model-value="percent" class="h-2" />
                </div>
            </div>
        </div>
        <MediaDetails
            v-if="detail && hasDetails"
            class="motion-safe:animate-in fade-in animation-duration-500 max-w-3xl"
            :description="detail.description"
            :genres="detail.genres"
            :facts="detail.facts"
        />
        <div
            v-else-if="!detail && !headerError"
            class="flex justify-center p-4"
        >
            <Spinner class="size-6" />
        </div>
        <FormError :message="headerError" />

        <PagedList :list="volumes" empty-text="Nothing from this series here.">
            <template #default="{ items }">
                <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    <li
                        v-for="(item, index) in items"
                        v-bind="staggerIn(index)"
                        :key="item.id"
                        class="group"
                    >
                        <RouterLink
                            :to="{
                                name: 'item',
                                params: { id: item.catalogItemId },
                            }"
                            class="grid gap-1"
                        >
                            <CoverImage
                                size="md"
                                :src="item.coverUrl"
                                :alt="item.title"
                                class="aspect-2/3 w-full transition duration-200 ease-out group-hover:-translate-y-1 group-hover:shadow-md"
                            />
                            <p class="text-xs font-medium">
                                Vol. {{ item.position ?? '?' }}
                            </p>
                            <p
                                class="text-muted-foreground line-clamp-2 min-h-8 text-xs"
                            >
                                {{ item.title }}
                            </p>
                            <ProgressMark
                                v-if="labels"
                                :status="item.status"
                                :rating="item.rating"
                                :labels="labels"
                            />
                        </RouterLink>
                    </li>
                </ul>
            </template>
        </PagedList>
    </div>
</template>
