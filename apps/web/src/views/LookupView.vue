<script setup lang="ts">
import { MediaFormat } from '@analog/types';
import BackButton from '@/components/BackButton.vue';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import SearchInput from '@/components/SearchInput.vue';
import BookResult from '@/components/scan/BookResult.vue';
import IsbnScanner from '@/components/scan/IsbnScanner.vue';
import { Alert, AlertDescription } from '@/components/shadcn-components/alert';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { Empty, EmptyDescription } from '@/components/shadcn-components/empty';
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
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
    type GoogleResult,
    type IsbnLookup,
    useGoogleSearch,
    useIsbnLookup,
} from '@/composables/useCatalog';
import {
    useAddCollectionItems,
    useCatalogItems,
    useCollection,
} from '@/composables/useCollections';
import { useSearchTerm } from '@/composables/useSearchTerm';
import { MEDIA_TYPES, type MediaTypeValue } from '@/lib/media-types';
import { staggerIn } from '@/lib/motion';

import { CheckCircleIcon, PlusIcon, SearchIcon } from '@lucide/vue';
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

// Google is searched when asked to, or when nothing here matches.
const searchMoreTerm = ref<string | null>(null);
const showGoogle = computed(
    () =>
        !!term.value &&
        !isTyping.value &&
        (searchMoreTerm.value === term.value ||
            (!results.isLoading && !results.error && !results.items.length))
);
const {
    data: googleResults,
    isLoading: googleLoading,
    error: googleError,
} = useGoogleSearch(term, showGoogle);

const lookupIsbn = useIsbnLookup();
const picked = ref<IsbnLookup | null>(null);
const picking = ref<string | null>(null);
const pickError = ref<string | null>(null);
const lastAdded = ref<string | null>(null);

async function pick(result: GoogleResult) {
    picking.value = result.isbn;
    pickError.value = null;
    lastAdded.value = null;
    try {
        picked.value = await lookupIsbn(result.isbn);
    } catch (err) {
        pickError.value = err instanceof Error ? err.message : null;
    } finally {
        picking.value = null;
    }
}

function onAdded() {
    lastAdded.value = picked.value?.book.title ?? null;
    picked.value = null;
}

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
    <div class="mx-auto flex w-full max-w-lg flex-col gap-4">
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
                <Alert v-if="lastAdded && !picked">
                    <CheckCircleIcon />
                    <AlertDescription>
                        Added {{ lastAdded }} to {{ collection.name }}.
                    </AlertDescription>
                </Alert>

                <BookResult
                    v-if="picked"
                    :key="picked.book.isbn"
                    :lookup="picked"
                    :collection="collection"
                    done-text="Back to results"
                    @done="picked = null"
                    @added="onAdded"
                />
                <template v-else>
                    <SearchInput v-model="query" placeholder="Search titles" />

                    <PagedList
                        v-if="term && (results.items.length || !showGoogle)"
                        :list="results"
                        empty-text="No titles match."
                    >
                        <template #default="{ items }">
                            <ItemGroup>
                                <Item
                                    v-for="(item, index) in items"
                                    v-bind="staggerIn(index)"
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
                                            <Spinner
                                                v-if="adding.has(item.id)"
                                            />
                                            <PlusIcon v-else />
                                            Add
                                        </Button>
                                    </ItemActions>
                                </Item>
                            </ItemGroup>
                        </template>
                    </PagedList>

                    <Button
                        v-if="term && !isTyping && !showGoogle"
                        variant="outline"
                        @click="searchMoreTerm = term"
                    >
                        <SearchIcon />
                        Search more
                    </Button>

                    <section v-if="showGoogle" class="grid gap-2">
                        <h2 class="font-medium">More results</h2>
                        <FormError
                            :message="pickError ?? googleError?.message ?? null"
                        />
                        <div
                            v-if="googleLoading"
                            class="flex justify-center p-8"
                        >
                            <Spinner class="size-6" />
                        </div>
                        <Empty
                            v-else-if="googleResults && !googleResults.length"
                            class="motion-safe:animate-in fade-in animation-duration-500"
                        >
                            <EmptyDescription>Nothing found.</EmptyDescription>
                        </Empty>
                        <ItemGroup v-else-if="googleResults">
                            <Item
                                v-for="(result, index) in googleResults"
                                v-bind="staggerIn(index)"
                                :key="result.isbn"
                                size="sm"
                            >
                                <ItemMedia>
                                    <CoverImage
                                        :src="result.coverUrl"
                                        alt=""
                                        size="sm"
                                        class="h-12 w-8"
                                    />
                                </ItemMedia>
                                <ItemContent>
                                    <ItemTitle>{{ result.title }}</ItemTitle>
                                    <ItemDescription>
                                        {{
                                        [result.author, result.language, result.year]
                                            .filter(Boolean)
                                            .join(' · ')
                                        }}
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        :disabled="picking !== null"
                                        @click="pick(result)"
                                    >
                                        <Spinner
                                            v-if="picking === result.isbn"
                                        />
                                        <PlusIcon v-else />
                                        Add
                                    </Button>
                                </ItemActions>
                            </Item>
                        </ItemGroup>
                    </section>
                </template>
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
    </div>
</template>
