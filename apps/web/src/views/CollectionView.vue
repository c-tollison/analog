<script setup lang="ts">
import { CollectionSort } from '@analog/types';
import BackButton from '@/components/BackButton.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import CoverRating from '@/components/progress/CoverRating.vue';
import ProgressMark from '@/components/progress/ProgressMark.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/shadcn-components/select';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    useCollection,
    useCollectionEntries,
    useRemoveCollectionItem,
} from '@/composables/useCollections';
import { usePageTitle } from '@/composables/usePageTitle';
import { useQueryParam } from '@/composables/useQueryParam';
import { SERIES_KIND_LABELS } from '@/lib/book-labels';
import { staggerIn } from '@/lib/motion';

import { PlusIcon, SettingsIcon, XIcon } from '@lucide/vue';
import { computed, ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

const props = defineProps<{ id: string }>();

const { data: collection, error: loadError } = useCollection(() => props.id);
usePageTitle(() => collection.value?.name);

// Visitors get a read-only page. Edit controls wait for the role to load.
const isMember = computed(() => !!collection.value?.role);
const isVisitor = computed(() => collection.value?.role === null);

const back = computed<{ to: RouteLocationRaw; text: string }>(() =>
    collection.value && isVisitor.value
        ? {
              to: {
                  name: 'user',
                  params: { username: collection.value.ownerUsername },
              },
              text: `Back to ${collection.value.ownerName}`,
          }
        : { to: { name: 'collections' }, text: 'Shelves' }
);

// Members manage a series on its own page; visitors see what this shelf
// holds.
function seriesLink(seriesId: string): RouteLocationRaw {
    return isMember.value
        ? {
              name: 'series',
              params: { id: seriesId },
              query: { shelf: props.id },
          }
        : { name: 'collection-series', params: { id: props.id, seriesId } };
}

const SORT_LABELS: Record<CollectionSort, string> = {
    [CollectionSort.Name]: 'Name',
    [CollectionSort.Newest]: 'Recently added',
};
const sort = useQueryParam(
    'sort',
    Object.values(CollectionSort),
    CollectionSort.Name
);

const entries = useCollectionEntries(() => props.id, sort);

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

const progress = computed(() => {
    const summary = collection.value;
    if (!summary || summary.itemCount === 0) return null;
    const counts = `${summary.completedCount} of ${summary.itemCount} read`;
    // A visitor sees the owner's progress, so say whose it is.
    return isVisitor.value ? `${summary.ownerName} · ${counts}` : counts;
});

const headerError = computed(
    () => (loadError.value ?? removeError.value)?.message ?? null
);
</script>

<template>
    <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
            <BackButton :to="back.to" :text="back.text" />
            <Button v-if="isMember" size="sm" as-child>
                <RouterLink :to="{ name: 'collection-scan', params: { id } }">
                    <PlusIcon />
                    {{ collection ? `Add to ${collection.name}` : 'Add' }}
                </RouterLink>
            </Button>
        </div>

        <div class="flex min-h-7 items-center justify-between gap-2">
            <div
                v-if="collection"
                class="motion-safe:animate-in fade-in animation-duration-500 grid"
            >
                <h1 class="text-lg font-semibold">{{ collection.name }}</h1>
                <p v-if="progress" class="text-muted-foreground text-xs">
                    {{ progress }}
                </p>
            </div>
            <Spinner v-else-if="!headerError" />
            <Button v-if="isMember" variant="ghost" size="sm" as-child>
                <RouterLink
                    :to="{ name: 'collection-settings', params: { id } }"
                >
                    <SettingsIcon />
                    Settings
                </RouterLink>
            </Button>
        </div>
        <FormError :message="headerError" />

        <ConfirmDialog
            v-model:open="confirmingRemove"
            :title="`Remove ${removing?.title ?? 'item'}?`"
            description="It'll be taken off this shelf."
            confirm-text="Remove"
            :pending="isRemoving"
            @confirm="onRemove"
        />

        <div class="flex justify-end">
            <Select v-model="sort">
                <SelectTrigger class="w-auto shrink-0" aria-label="Sort by">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem
                        v-for="(label, value) in SORT_LABELS"
                        :key="value"
                        :value="value"
                    >
                        {{ label }}
                    </SelectItem>
                </SelectContent>
            </Select>
        </div>

        <PagedList
            :list="entries"
            :empty-text="
                isMember ? 'Nothing here yet. Scan something in.' : 'Nothing here yet.'
            "
        >
            <template #default="{ items }">
                <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    <li
                        v-for="(entry, index) in items"
                        v-bind="staggerIn(index)"
                        :key="entry.id"
                        class="group relative"
                    >
                        <RouterLink
                            v-if="entry.series"
                            :to="seriesLink(entry.series.id)"
                            class="grid gap-1"
                        >
                            <CoverImage
                                size="md"
                                :src="entry.coverUrl ?? entry.series.coverUrl"
                                :alt="entry.series.title"
                                class="aspect-2/3 w-full transition duration-200 ease-out group-hover:-translate-y-1 group-hover:shadow-md"
                            />
                            <p class="line-clamp-2 min-h-8 text-xs font-medium">
                                {{ entry.series.title }}
                            </p>
                            <div class="flex flex-wrap items-center gap-1">
                                <Badge variant="secondary">
                                    {{ SERIES_KIND_LABELS[entry.series.kind] }}
                                </Badge>
                                <span class="text-muted-foreground text-xs">
                                    {{ entry.ownedCount }} owned ·
                                    {{ entry.completedCount }}
                                    read
                                </span>
                            </div>
                        </RouterLink>

                        <RouterLink
                            v-else
                            :to="{
                                name: 'item',
                                params: { id: entry.catalogItemId },
                            }"
                            class="grid gap-1"
                        >
                            <CoverImage
                                size="md"
                                :src="entry.coverUrl"
                                :alt="entry.title"
                                class="aspect-2/3 w-full transition duration-200 ease-out group-hover:-translate-y-1 group-hover:shadow-md"
                            >
                                <CoverRating
                                    v-if="entry.rating !== null"
                                    :rating="entry.rating"
                                />
                            </CoverImage>
                            <p class="line-clamp-2 min-h-8 text-xs font-medium">
                                {{ entry.title }}
                            </p>
                            <div class="flex flex-wrap items-center gap-1">
                                <Badge variant="secondary">
                                    {{
                                        entry.kind
                                            ? SERIES_KIND_LABELS[entry.kind]
                                            : 'Book'
                                    }}
                                </Badge>
                                <span
                                    v-if="entry.position !== null"
                                    class="text-muted-foreground text-xs"
                                >
                                    Vol. {{ entry.position }}
                                </span>
                            </div>
                            <ProgressMark
                                :status="entry.status"
                                :rating="entry.rating"
                            />
                        </RouterLink>
                        <Button
                            v-if="isMember && !entry.series"
                            variant="secondary"
                            size="icon"
                            class="absolute top-1 right-1 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                            :aria-label="`Remove ${entry.title}`"
                            @click="removing = { id: entry.id, title: entry.title }"
                        >
                            <XIcon />
                        </Button>
                    </li>
                </ul>
            </template>
        </PagedList>
    </div>
</template>
