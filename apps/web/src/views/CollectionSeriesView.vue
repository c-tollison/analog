<script setup lang="ts">
import BackButton from '@/components/BackButton.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import CoverImage from '@/components/CoverImage.vue';
import AddFromCatalogDialog from '@/components/collections/AddFromCatalogDialog.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import MediaDetails from '@/components/media/MediaDetails.vue';
import ProgressMark from '@/components/progress/ProgressMark.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { Progress } from '@/components/shadcn-components/progress';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    useCollection,
    useCollectionSeries,
    useCollectionSeriesItems,
    useRemoveCollectionItem,
} from '@/composables/useCollections';
import {
    addMoreLabel,
    completedWord,
    kindStatusLabels,
    SERIES_KIND_LABELS,
} from '@/lib/media-types';
import { missingVolumes } from '@/lib/volumes';

import { PlusIcon, XIcon } from '@lucide/vue';
import { computed, ref } from 'vue';

const props = defineProps<{ id: string; seriesId: string }>();

const isAddOpen = ref(false);

const { data: detail, error: detailError } = useCollectionSeries(
    () => props.id,
    () => props.seriesId
);

const { data: collection, error: collectionError } = useCollection(
    () => props.id
);
const collectionName = computed(() => collection.value?.name ?? null);

const volumes = useCollectionSeriesItems(
    () => props.id,
    () => props.seriesId
);

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
    if (!removing.value) return;
    removeItem(
        { collectionId: props.id, itemId: removing.value.id },
        { onSettled: () => (removing.value = null) }
    );
}

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
    () =>
        (detailError.value ?? collectionError.value ?? removeError.value)
            ?.message ?? null
);
</script>

<template>
    <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
            <BackButton
                :to="{ name: 'collection', params: { id } }"
                text="Back to collection"
            />
            <Button
                variant="outline"
                size="sm"
                :disabled="!detail || !collectionName"
                @click="isAddOpen = true"
            >
                <PlusIcon />
                {{ detail ? addMoreLabel(detail.series.kind) : 'Add more' }}
            </Button>
        </div>

        <AddFromCatalogDialog
            v-if="detail && collectionName"
            v-model:open="isAddOpen"
            :collection-id="id"
            :collection-name="collectionName"
            :series="detail.series"
        />

        <div v-if="detail && labels" class="flex gap-4">
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
            class="max-w-3xl"
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

        <ConfirmDialog
            v-model:open="confirmingRemove"
            :title="`Remove ${removing?.title ?? 'item'}?`"
            description="It'll be taken out of this collection."
            confirm-text="Remove"
            :pending="isRemoving"
            @confirm="onRemove"
        />

        <PagedList :list="volumes" empty-text="Nothing from this series here.">
            <template #default="{ items }">
                <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    <li
                        v-for="item in items"
                        :key="item.id"
                        class="group relative"
                    >
                        <RouterLink
                            :to="{
                                name: 'collection-item',
                                params: { id, itemId: item.id },
                            }"
                            class="grid gap-1"
                        >
                            <CoverImage
                                size="md"
                                :src="item.coverUrl"
                                :alt="item.title"
                                class="aspect-2/3 w-full transition-opacity group-hover:opacity-90"
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
                        <Button
                            variant="secondary"
                            size="icon"
                            class="absolute top-1 right-1 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                            :aria-label="`Remove ${item.title}`"
                            @click="removing = { id: item.id, title: item.title }"
                        >
                            <XIcon />
                        </Button>
                    </li>
                </ul>
            </template>
        </PagedList>
    </div>
</template>
