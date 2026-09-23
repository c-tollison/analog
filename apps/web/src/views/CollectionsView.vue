<script setup lang="ts">
import type { InferResponseType } from '@analog/api/client';
import CoverImage from '@/components/CoverImage.vue';
import CreateCollectionDialog from '@/components/collections/CreateCollectionDialog.vue';
import PagedList from '@/components/lists/PagedList.vue';
import SearchInput from '@/components/SearchInput.vue';
import {
    AvatarGroup,
    AvatarGroupCount,
} from '@/components/shadcn-components/avatar';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from '@/components/shadcn-components/item';
import UserAvatar from '@/components/users/UserAvatar.vue';
import {
    useCollectionSearch,
    useCollections,
} from '@/composables/useCollections';
import { useSearchTerm } from '@/composables/useSearchTerm';
import type { ApiClient } from '@/lib/api';

import { PlusIcon, ScanBarcodeIcon, SettingsIcon } from '@lucide/vue';
import { ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

const isCreateOpen = ref(false);
const query = ref('');
const { trimmed: trimmedQuery, term, isTyping } = useSearchTerm(query);

const collections = useCollections();

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
        : { name: 'collection', params: { id } };
}
</script>

<template>
    <main class="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
        <div class="flex items-center justify-between">
            <h1 class="text-lg font-semibold">Collections</h1>
            <div class="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    @click="isCreateOpen = true"
                >
                    <PlusIcon />
                    New collection
                </Button>
                <Button size="sm" as-child>
                    <RouterLink :to="{ name: 'scan' }">
                        <ScanBarcodeIcon />
                        Scan
                    </RouterLink>
                </Button>
            </div>
        </div>

        <CreateCollectionDialog v-model:open="isCreateOpen" />

        <SearchInput v-model="query" placeholder="Search all collections" />

        <PagedList
            v-if="trimmedQuery"
            :list="results"
            empty-text="Nothing in your collections matches."
        >
            <template #default="{ items }">
                <ul class="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <li v-for="result in items" :key="result.id">
                        <RouterLink
                            :to="resultLink(result)"
                            class="group grid gap-1.5"
                        >
                            <CoverImage
                                size="md"
                                :src="result.coverUrl"
                                :alt="result.title"
                                class="aspect-2/3 w-full transition-opacity group-hover:opacity-90"
                            />
                            <p class="line-clamp-2 text-sm font-medium">
                                {{ result.title }}
                            </p>
                            <div class="flex flex-wrap items-center gap-1.5">
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
                    <Item
                        v-for="c in items"
                        :key="c.id"
                        variant="outline"
                        class="has-[a:hover]:bg-muted relative"
                    >
                        <ItemContent class="min-w-0">
                            <ItemTitle class="w-full">
                                <RouterLink
                                    :to="{
                                        name: 'collection',
                                        params: { id: c.id },
                                    }"
                                    class="truncate after:absolute after:inset-0"
                                >
                                    {{ c.name }}
                                </RouterLink>
                            </ItemTitle>
                            <ItemDescription>
                                {{ c.itemCount }}
                                {{ c.itemCount === 1 ? 'item' : 'items' }}
                            </ItemDescription>
                        </ItemContent>
                        <ItemActions class="relative">
                            <AvatarGroup v-if="c.memberCount > 1">
                                <UserAvatar
                                    v-for="member in c.members"
                                    :key="member.id"
                                    :name="member.name"
                                    :image="member.image"
                                    size="sm"
                                />
                                <AvatarGroupCount
                                    v-if="c.memberCount > c.members.length"
                                >
                                    +{{ c.memberCount - c.members.length }}
                                </AvatarGroupCount>
                            </AvatarGroup>
                            <Button
                                variant="ghost"
                                size="icon"
                                :aria-label="`${c.name} settings`"
                                as-child
                            >
                                <RouterLink
                                    :to="{
                                        name: 'collection-settings',
                                        params: { id: c.id },
                                    }"
                                >
                                    <SettingsIcon />
                                </RouterLink>
                            </Button>
                        </ItemActions>
                    </Item>
                </ItemGroup>
            </template>
        </PagedList>
    </main>
</template>
