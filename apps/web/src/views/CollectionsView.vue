<script setup lang="ts">
import type { InferResponseType } from '@analog/api/client';
import CoverImage from '@/components/CoverImage.vue';
import CollectionRow from '@/components/collections/CollectionRow.vue';
import CreateCollectionDialog from '@/components/collections/CreateCollectionDialog.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import SearchInput from '@/components/SearchInput.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { ItemGroup } from '@/components/shadcn-components/item';
import { Label } from '@/components/shadcn-components/label';
import { Switch } from '@/components/shadcn-components/switch';
import {
    useCollectionSearch,
    useCollections,
} from '@/composables/useCollections';
import { useSearchTerm } from '@/composables/useSearchTerm';
import { useUpdatePreferences } from '@/composables/useUsers';
import type { ApiClient } from '@/lib/api';
import { staggerIn } from '@/lib/motion';
import { useSessionStore } from '@/stores/session';

import { PlusIcon } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

const isCreateOpen = ref(false);
const query = ref('');
const { trimmed: trimmedQuery, term, isTyping } = useSearchTerm(query);

const collections = useCollections();

const { session } = storeToRefs(useSessionStore());
const preferences = useUpdatePreferences();

// Follows the toggle while the save is in flight.
const showProgress = computed(
    () =>
        (preferences.isPending.value
            ? preferences.variables.value?.showCollectionProgress
            : undefined) ??
        session.value?.user.showCollectionProgress ??
        true
);

function setShowProgress(showCollectionProgress: boolean) {
    preferences.mutate({ showCollectionProgress });
}

// Searches every collection; nothing loads until something is typed.
const results = useCollectionSearch(term, { pending: isTyping });

type SearchResult = InferResponseType<
    ApiClient['collections']['search']['$get'],
    200
>['items'][number];

function resultLink(result: SearchResult): RouteLocationRaw {
    const id = result.collectionId;
    return result.seriesId
        ? {
              name: 'collection-series',
              params: { id, seriesId: result.seriesId },
          }
        : { name: 'item', params: { id: result.catalogItemId } };
}
</script>

<template>
    <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
            <h1 class="text-lg font-semibold">Collections</h1>
            <Button size="sm" @click="isCreateOpen = true">
                <PlusIcon />
                New collection
            </Button>
        </div>

        <FormError :message="preferences.error.value?.message ?? null" />

        <CreateCollectionDialog v-model:open="isCreateOpen" />

        <div class="flex items-center gap-4">
            <SearchInput v-model="query" placeholder="Search all collections" />
            <div class="flex shrink-0 items-center gap-2">
                <Switch
                    id="show-progress"
                    :model-value="showProgress"
                    @update:model-value="setShowProgress"
                />
                <Label for="show-progress">Progress</Label>
            </div>
        </div>

        <PagedList
            v-if="trimmedQuery"
            :list="results"
            empty-text="Nothing in your collections matches."
        >
            <template #default="{ items }">
                <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    <li
                        v-for="(result, index) in items"
                        v-bind="staggerIn(index)"
                        :key="result.id"
                    >
                        <RouterLink
                            :to="resultLink(result)"
                            class="group grid gap-1"
                        >
                            <CoverImage
                                size="md"
                                :src="result.coverUrl"
                                :alt="result.title"
                                class="aspect-2/3 w-full transition duration-200 ease-out group-hover:-translate-y-1 group-hover:shadow-md"
                            />
                            <p class="line-clamp-2 min-h-8 text-xs font-medium">
                                {{ result.title }}
                            </p>
                            <div class="flex flex-wrap items-center gap-1">
                                <Badge variant="secondary">
                                    {{ result.collectionName }}
                                </Badge>
                                <span
                                    v-if="result.position !== null"
                                    class="text-muted-foreground text-xs"
                                >
                                    Vol. {{ result.position }}
                                </span>
                            </div>
                        </RouterLink>
                    </li>
                </ul>
            </template>
        </PagedList>

        <PagedList
            v-else
            :list="collections"
            empty-text="No collections yet. Click New collection to make one."
        >
            <template #default="{ items }">
                <ItemGroup class="grid sm:grid-cols-2">
                    <CollectionRow
                        v-for="(c, index) in items"
                        v-bind="staggerIn(index)"
                        :key="c.id"
                        :collection="c"
                        :show-progress="showProgress"
                    />
                </ItemGroup>
            </template>
        </PagedList>
    </div>
</template>
