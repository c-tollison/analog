<script setup lang="ts">
import { MediaFormat } from '@analog/types';
import BackButton from '@/components/BackButton.vue';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import SearchInput from '@/components/SearchInput.vue';
import IsbnScanner from '@/components/scan/IsbnScanner.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import {
    Item,
    ItemActions,
    ItemContent,
    ItemGroup,
    ItemMedia,
    ItemTitle,
} from '@/components/shadcn-components/item';
import { Label } from '@/components/shadcn-components/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/shadcn-components/select';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/shadcn-components/tabs';
import {
    useAddCollectionItems,
    useCatalogItems,
    useCollection,
} from '@/composables/useCollections';
import { useSearchTerm } from '@/composables/useSearchTerm';
import { MEDIA_TYPES, type MediaTypeValue } from '@/lib/media-types';

import { PlusIcon } from '@lucide/vue';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const TABS = ['lookup', 'scan'] as const;
type Tab = (typeof TABS)[number];

function isTab(value: unknown): value is Tab {
    return TABS.some((tab) => tab === value);
}

const props = defineProps<{ collectionId: string }>();

const route = useRoute();
const router = useRouter();

const tab = computed({
    get: (): Tab => (isTab(route.query.tab) ? route.query.tab : 'lookup'),
    set: (value) => {
        router.replace({ query: { ...route.query, tab: value } });
    },
});

const { data: collection, error: loadError } = useCollection(
    () => props.collectionId
);

const query = ref('');
const { term, isTyping } = useSearchTerm(query);

const results = useCatalogItems(() => props.collectionId, term, undefined, {
    pending: isTyping,
});

const addItems = useAddCollectionItems();
const adding = ref(new Set<string>());

function add(catalogItemId: string) {
    adding.value.add(catalogItemId);
    addItems.mutate(
        { collectionId: props.collectionId, catalogItemIds: [catalogItemId] },
        { onSettled: () => adding.value.delete(catalogItemId) }
    );
}

const mediaType = ref<MediaTypeValue>(MediaFormat.Book);
const formats = computed(
    () => MEDIA_TYPES.find((t) => t.value === mediaType.value)?.formats ?? []
);

const error = computed(
    () => (loadError.value ?? addItems.error.value)?.message ?? null
);
</script>

<template>
    <main class="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
        <div>
            <BackButton
                :to="{ name: 'collection', params: { id: collectionId } }"
                :text="collection?.name ?? 'Collection'"
                class="-ml-2"
            />
        </div>

        <h1 v-if="collection" class="text-lg font-semibold">
            Add to {{ collection.name }}
        </h1>
        <Spinner v-else-if="!loadError" />
        <FormError :message="error" />

        <Tabs v-if="collection" v-model="tab">
            <TabsList>
                <TabsTrigger value="lookup">Look up</TabsTrigger>
                <TabsTrigger value="scan">Scan</TabsTrigger>
            </TabsList>

            <TabsContent value="lookup" class="grid gap-4 pt-2">
                <SearchInput v-model="query" placeholder="Search titles" />

                <PagedList
                    v-if="term"
                    :list="results"
                    empty-text="No titles match."
                >
                    <template #default="{ items }">
                        <ItemGroup>
                            <Item
                                v-for="item in items"
                                :key="item.id"
                                size="sm"
                            >
                                <ItemMedia>
                                    <CoverImage
                                        :src="item.coverUrl"
                                        alt=""
                                        size="sm"
                                        class="h-12 w-8"
                                    />
                                </ItemMedia>
                                <ItemContent>
                                    <ItemTitle>
                                        <span v-if="item.position !== null">
                                            Vol. {{ item.position }} ·
                                        </span>
                                        {{ item.title }}
                                    </ItemTitle>
                                </ItemContent>
                                <ItemActions>
                                    <Badge
                                        v-if="item.inCollection"
                                        variant="secondary"
                                    >
                                        Added
                                    </Badge>
                                    <Button
                                        v-else
                                        variant="outline"
                                        size="sm"
                                        :disabled="adding.has(item.id)"
                                        @click="add(item.id)"
                                    >
                                        <Spinner v-if="adding.has(item.id)" />
                                        <PlusIcon v-else />
                                        Add
                                    </Button>
                                </ItemActions>
                            </Item>
                        </ItemGroup>
                    </template>
                </PagedList>
            </TabsContent>

            <TabsContent value="scan" class="grid gap-4 pt-2">
                <IsbnScanner :formats="formats" :collection="collection">
                    <div class="grid gap-1.5">
                        <Label for="media-type">Type</Label>
                        <Select v-model="mediaType">
                            <SelectTrigger id="media-type" class="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem
                                    v-for="type in MEDIA_TYPES"
                                    :key="type.value"
                                    :value="type.value"
                                >
                                    {{ type.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </IsbnScanner>
            </TabsContent>
        </Tabs>
    </main>
</template>
