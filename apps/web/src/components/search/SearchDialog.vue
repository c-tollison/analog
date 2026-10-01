<script setup lang="ts">
import type { InferResponseType } from '@analog/api/client';
import { Relationship, USER_SEARCH_MIN_LENGTH } from '@analog/types';
import CoverImage from '@/components/CoverImage.vue';
import PagedList from '@/components/lists/PagedList.vue';
import SearchInput from '@/components/SearchInput.vue';
import BookSearchItem from '@/components/search/BookSearchItem.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/shadcn-components/dialog';
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemMedia,
    ItemTitle,
} from '@/components/shadcn-components/item';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/shadcn-components/tabs';
import UserItem from '@/components/users/UserItem.vue';
import { useCollectionSearch } from '@/composables/useCollections';
import { useBookSearch } from '@/composables/useItems';
import { useSearchTerm } from '@/composables/useSearchTerm';
import { useSeriesSearch } from '@/composables/useSeries';
import { useUserSearch } from '@/composables/useUsers';
import type { ApiClient } from '@/lib/api';
import { SERIES_KIND_LABELS } from '@/lib/media-types';
import { staggerIn } from '@/lib/motion';
import { useSearchStore } from '@/stores/search';

import { PlusIcon, XIcon } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { type RouteLocationRaw, useRoute } from 'vue-router';

const TABS = ['books', 'series', 'people', 'shelves'] as const;
type Tab = (typeof TABS)[number];

function isTab(value: unknown): value is Tab {
    return TABS.some((tab) => tab === value);
}

const RELATIONSHIP_LABELS: Partial<Record<Relationship, string>> = {
    [Relationship.Friends]: 'Friend',
    [Relationship.RequestSent]: 'Requested',
    [Relationship.RequestReceived]: 'Wants to be friends',
};

const search = useSearchStore();
const { isOpen } = storeToRefs(search);

const tab = ref<Tab>('books');
const query = ref('');
const { term, isTyping } = useSearchTerm(query);

// Only the open tab searches.
function listFor(name: Tab, minLength = 1) {
    return {
        enabled: () =>
            isOpen.value &&
            tab.value === name &&
            term.value.length >= minLength,
        pending: isTyping,
    };
}

const books = useBookSearch(term, listFor('books'));
const series = useSeriesSearch(term, listFor('series'));
const people = useUserSearch(term, listFor('people', USER_SEARCH_MIN_LENGTH));
const shelves = useCollectionSearch(term, listFor('shelves'));

type ShelfResult = InferResponseType<
    ApiClient['collections']['search']['$get'],
    200
>['items'][number];

function shelfLink(result: ShelfResult): RouteLocationRaw {
    return result.seriesId
        ? {
              name: 'series',
              params: { id: result.seriesId },
              query: { shelf: result.collectionId },
          }
        : { name: 'item', params: { id: result.catalogItemId } };
}

const isTooShort = computed(
    () =>
        tab.value === 'people' &&
        term.value.length > 0 &&
        term.value.length < USER_SEARCH_MIN_LENGTH
);

// Opening a result moves to its page, which closes search.
const route = useRoute();
watch(
    () => route.fullPath,
    () => (isOpen.value = false)
);
</script>

<template>
    <Dialog v-model:open="isOpen">
        <!-- Full screen on phones, a large panel near the top on wider
             screens. -->
        <DialogContent
            :show-close-button="false"
            class="top-0 left-0 flex h-svh max-w-none translate-x-0 translate-y-0 flex-col gap-3 rounded-none sm:top-[10%] sm:left-1/2 sm:h-[85svh] sm:max-w-2xl sm:-translate-x-1/2 sm:rounded-xl"
        >
            <DialogHeader class="sr-only">
                <DialogTitle>Search</DialogTitle>
                <DialogDescription>
                    Search media, series, people and your shelves.
                </DialogDescription>
            </DialogHeader>

            <div class="flex items-center gap-2">
                <SearchInput
                    v-model="query"
                    placeholder="Title, series, person…"
                />
                <DialogClose as-child>
                    <Button variant="ghost" size="icon" aria-label="Close">
                        <XIcon />
                    </Button>
                </DialogClose>
            </div>

            <Tabs
                :model-value="tab"
                class="flex min-h-0 flex-1 flex-col gap-2"
                @update:model-value="(value) => isTab(value) && (tab = value)"
            >
                <TabsList>
                    <TabsTrigger value="books">Media</TabsTrigger>
                    <TabsTrigger value="series">Series</TabsTrigger>
                    <TabsTrigger value="people">People</TabsTrigger>
                    <TabsTrigger value="shelves">Shelves</TabsTrigger>
                </TabsList>

                <div v-if="term" class="min-h-0 flex-1 overflow-y-auto">
                    <TabsContent value="books">
                        <PagedList :list="books" empty-text="Nothing matches.">
                            <template #default="{ items }">
                                <ItemGroup class="grid gap-2">
                                    <BookSearchItem
                                        v-for="(book, index) in items"
                                        v-bind="staggerIn(index)"
                                        :key="book.id"
                                        :book="book"
                                    />
                                </ItemGroup>
                            </template>
                        </PagedList>
                    </TabsContent>

                    <TabsContent value="series">
                        <PagedList :list="series" empty-text="No series match.">
                            <template #default="{ items }">
                                <ItemGroup class="grid gap-2">
                                    <Item
                                        v-for="(result, index) in items"
                                        v-bind="staggerIn(index)"
                                        :key="result.id"
                                        variant="outline"
                                        size="sm"
                                        as-child
                                    >
                                        <RouterLink
                                            :to="{
                                                name: 'series',
                                                params: { id: result.id },
                                            }"
                                        >
                                            <ItemMedia>
                                                <CoverImage
                                                    size="sm"
                                                    :src="result.coverUrl"
                                                    :alt="result.title"
                                                    class="aspect-2/3 w-12"
                                                />
                                            </ItemMedia>
                                            <ItemContent class="min-w-0">
                                                <ItemTitle>
                                                    {{ result.title }}
                                                </ItemTitle>
                                                <ItemDescription>
                                                    {{
                                                        SERIES_KIND_LABELS[
                                                            result.kind
                                                        ]
                                                    }}
                                                    <template
                                                        v-if="result.volumeCount"
                                                    >
                                                        ·
                                                        {{ result.volumeCount }}
                                                        volumes
                                                    </template>
                                                </ItemDescription>
                                            </ItemContent>
                                        </RouterLink>
                                    </Item>
                                </ItemGroup>
                            </template>
                        </PagedList>
                    </TabsContent>

                    <TabsContent value="people">
                        <p
                            v-if="isTooShort"
                            class="text-muted-foreground p-4 text-center text-sm"
                        >
                            Type at least {{ USER_SEARCH_MIN_LENGTH }}
                            letters.
                        </p>
                        <PagedList
                            v-else
                            :list="people"
                            empty-text="No one matches."
                        >
                            <template #default="{ items }">
                                <ItemGroup class="grid gap-2">
                                    <UserItem
                                        v-for="(person, index) in items"
                                        v-bind="staggerIn(index)"
                                        :key="person.id"
                                        :user="person"
                                    >
                                        <template
                                            v-if="
                                                RELATIONSHIP_LABELS[
                                                    person.relationship
                                                ]
                                            "
                                            #actions
                                        >
                                            <Badge variant="secondary">
                                                {{
                                                    RELATIONSHIP_LABELS[
                                                        person.relationship
                                                    ]
                                                }}
                                            </Badge>
                                        </template>
                                    </UserItem>
                                </ItemGroup>
                            </template>
                        </PagedList>
                    </TabsContent>

                    <TabsContent value="shelves">
                        <PagedList
                            :list="shelves"
                            empty-text="Nothing on your shelves matches."
                        >
                            <template #default="{ items }">
                                <ItemGroup class="grid gap-2">
                                    <Item
                                        v-for="(result, index) in items"
                                        v-bind="staggerIn(index)"
                                        :key="result.id"
                                        variant="outline"
                                        size="sm"
                                        as-child
                                    >
                                        <RouterLink :to="shelfLink(result)">
                                            <ItemMedia>
                                                <CoverImage
                                                    size="sm"
                                                    :src="result.coverUrl"
                                                    :alt="result.title"
                                                    class="aspect-2/3 w-12"
                                                />
                                            </ItemMedia>
                                            <ItemContent class="min-w-0">
                                                <ItemTitle>
                                                    {{ result.title }}
                                                </ItemTitle>
                                                <ItemDescription>
                                                    {{ result.collectionName }}
                                                    <template
                                                        v-if="
                                                            result.position !==
                                                            null
                                                        "
                                                    >
                                                        · Vol.
                                                        {{ result.position }}
                                                    </template>
                                                </ItemDescription>
                                            </ItemContent>
                                        </RouterLink>
                                    </Item>
                                </ItemGroup>
                            </template>
                        </PagedList>
                    </TabsContent>
                </div>
            </Tabs>

            <DialogFooter class="sm:justify-start">
                <Button variant="outline" @click="search.openAdd()">
                    <PlusIcon />
                    Not here? Add by ISBN
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
