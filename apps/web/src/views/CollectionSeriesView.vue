<script setup lang="ts">
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import CoverImage from '@/components/CoverImage.vue';
import AddFromCatalogDialog from '@/components/collections/AddFromCatalogDialog.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    useCollection,
    useCollectionSeries,
    useCollectionSeriesItems,
    useRemoveCollectionItem,
} from '@/composables/useCollections';
import { SERIES_KIND_LABELS } from '@/lib/media-types';

import { ArrowLeftIcon, PlusIcon, XIcon } from '@lucide/vue';
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

const headerError = computed(
    () =>
        (detailError.value ?? collectionError.value ?? removeError.value)
            ?.message ?? null
);
</script>

<template>
    <main class="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
        <div class="flex items-center justify-between">
            <Button variant="ghost" size="sm" as-child>
                <RouterLink :to="{ name: 'collection', params: { id } }">
                    <ArrowLeftIcon />
                    Back to collection
                </RouterLink>
            </Button>
            <Button
                variant="outline"
                size="sm"
                :disabled="!detail || !collectionName"
                @click="isAddOpen = true"
            >
                <PlusIcon />
                Add volumes
            </Button>
        </div>

        <AddFromCatalogDialog
            v-if="detail && collectionName"
            v-model:open="isAddOpen"
            :collection-id="id"
            :collection-name="collectionName"
            :series="detail.series"
        />

        <div v-if="detail" class="flex gap-4">
            <CoverImage
                size="md"
                :src="detail.series.coverUrl"
                :alt="detail.series.title"
                class="h-36 w-24 shrink-0"
            />
            <div class="grid content-start gap-1.5">
                <h1 class="text-lg font-semibold">
                    {{ detail.series.title }}
                </h1>
                <div class="flex items-center gap-1.5">
                    <Badge variant="secondary">
                        {{ SERIES_KIND_LABELS[detail.series.kind] }}
                    </Badge>
                    <span class="text-muted-foreground text-xs">
                        {{ detail.ownedCount }} owned
                    </span>
                </div>
            </div>
        </div>
        <div v-else-if="!headerError" class="flex justify-center p-4">
            <Spinner class="size-6" />
        </div>
        <FormError :message="headerError" />

        <ConfirmDialog
            v-model:open="confirmingRemove"
            :title="`Remove ${removing?.title ?? 'item'}?`"
            description="This takes it out of the collection."
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
                        class="group relative grid gap-1"
                    >
                        <CoverImage
                            size="md"
                            :src="item.coverUrl"
                            :alt="item.title"
                            class="aspect-2/3 w-full"
                        />
                        <p class="text-xs font-medium">
                            Vol. {{ item.position ?? '?' }}
                        </p>
                        <p class="text-muted-foreground line-clamp-2 text-xs">
                            {{ item.title }}
                        </p>
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
    </main>
</template>
