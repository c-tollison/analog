<script setup lang="ts">
import { AddedSort, VerifiedFilter } from '@analog/types';
import BackButton from '@/components/BackButton.vue';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import SearchInput from '@/components/SearchInput.vue';
import BookResult from '@/components/scan/BookResult.vue';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/shadcn-components/select';
import { Spinner } from '@/components/shadcn-components/spinner';
import { adminListQuery, useAdminItems } from '@/composables/useAdmin';
import {
    GOOGLE_SEARCH_DELAY_MS,
    type GoogleResult,
    type IsbnLookup,
    useAdminGoogleSearch,
    useIsbnLookup,
} from '@/composables/useCatalog';
import { useSearchTerm } from '@/composables/useSearchTerm';
import { SEARCH_LANGUAGES } from '@/lib/languages';
import { staggerIn } from '@/lib/motion';

import { CheckCircleIcon, PlusIcon, SearchIcon } from '@lucide/vue';
import { computed, ref } from 'vue';

const ANY_LANGUAGE = 'any';

const query = ref('');
const { term } = useSearchTerm(query);
// Google waits for a longer pause, since each search counts.
const { term: googleTerm, isTyping: googleTyping } = useSearchTerm(query, {
    delayMs: GOOGLE_SEARCH_DELAY_MS,
});

const {
    data: ours,
    isLoading: oursLoading,
    error: oursError,
} = useAdminItems(
    () =>
        adminListQuery(
            {
                q: term.value,
                status: VerifiedFilter.All,
                sort: AddedSort.Newest,
            },
            1
        ),
    () => !!term.value
);
const ourItems = computed(() => (term.value ? (ours.value?.items ?? []) : []));

const language = ref('en');

// Google is searched when asked to, or when nothing here matches.
const searchMoreTerm = ref<string | null>(null);
const showGoogle = computed(
    () =>
        !!googleTerm.value &&
        !googleTyping.value &&
        (searchMoreTerm.value === googleTerm.value ||
            (!oursLoading.value && !oursError.value && !ourItems.value.length))
);
const google = useAdminGoogleSearch(
    googleTerm,
    () => (language.value === ANY_LANGUAGE ? null : language.value),
    showGoogle
);

const lookupIsbn = useIsbnLookup();
const picked = ref<IsbnLookup | null>(null);
const picking = ref<string | null>(null);
const pickError = ref<string | null>(null);
const lastSaved = ref<{
    title: string;
    itemId: string;
    seriesId: string | null;
} | null>(null);

async function pick(result: GoogleResult) {
    picking.value = result.isbn;
    pickError.value = null;
    lastSaved.value = null;
    try {
        picked.value = await lookupIsbn(result.isbn, result.googleId);
    } catch (err) {
        pickError.value = err instanceof Error ? err.message : null;
    } finally {
        picking.value = null;
    }
}

function onSaved(saved: { itemId: string; seriesId: string | null }) {
    lastSaved.value = { ...saved, title: picked.value?.book.title ?? '' };
    picked.value = null;
}
</script>

<template>
    <div class="mx-auto flex w-full max-w-lg flex-col gap-4">
        <div>
            <BackButton :to="{ name: 'admin' }" text="Admin" class="-ml-2" />
        </div>

        <h1 class="text-lg font-semibold">Add to catalog</h1>

        <Alert v-if="lastSaved && !picked">
            <CheckCircleIcon />
            <AlertDescription class="flex flex-wrap items-center gap-2">
                Saved {{ lastSaved.title }}.
                <Button as-child variant="outline" size="sm">
                    <RouterLink
                        v-if="lastSaved.seriesId"
                        :to="{
                            name: 'admin-series',
                            params: { id: lastSaved.seriesId },
                        }"
                    >
                        Open series
                    </RouterLink>
                    <RouterLink
                        v-else
                        :to="{
                            name: 'admin-item',
                            params: { id: lastSaved.itemId },
                        }"
                    >
                        Open item
                    </RouterLink>
                </Button>
            </AlertDescription>
        </Alert>

        <BookResult
            v-if="picked"
            :key="picked.book.isbn"
            :lookup="picked"
            :collection="null"
            admin
            done-text="Back to results"
            @done="picked = null"
            @saved="onSaved"
        />
        <template v-else>
            <SearchInput v-model="query" placeholder="Search titles" />

            <FormError :message="oursError?.message ?? null" />
            <div
                v-if="term && oursLoading && !ourItems.length"
                class="flex justify-center p-8"
            >
                <Spinner class="size-6" />
            </div>
            <Empty
                v-else-if="
                    term && !googleTyping && !ourItems.length && !showGoogle
                "
            >
                <EmptyDescription>No titles match.</EmptyDescription>
            </Empty>
            <ItemGroup v-else-if="ourItems.length">
                <Item
                    v-for="(item, index) in ourItems"
                    v-bind="staggerIn(index)"
                    :key="item.id"
                    size="sm"
                    class="has-[a:hover]:bg-muted relative"
                >
                    <ItemMedia>
                        <CoverImage
                            :src="item.coverUrl"
                            alt=""
                            size="sm"
                            class="h-12 w-8"
                        />
                    </ItemMedia>
                    <ItemContent class="min-w-0">
                        <ItemTitle class="line-clamp-2">
                            <RouterLink
                                :to="{
                                    name: 'admin-item',
                                    params: { id: item.id },
                                }"
                                class="after:absolute after:inset-0"
                            >
                                {{ item.title }}
                            </RouterLink>
                        </ItemTitle>
                        <ItemDescription v-if="item.seriesTitle">
                            {{ item.seriesTitle }}
                            <template v-if="item.position !== null">
                                · Vol. {{ item.position }}
                            </template>
                        </ItemDescription>
                    </ItemContent>
                    <ItemActions v-if="!item.verifiedAt">
                        <Badge variant="secondary">Unverified</Badge>
                    </ItemActions>
                </Item>
            </ItemGroup>

            <Button
                v-if="term && !googleTyping && !showGoogle"
                variant="outline"
                @click="searchMoreTerm = term"
            >
                <SearchIcon />
                Search more
            </Button>

            <section v-if="showGoogle" class="grid gap-2">
                <div class="flex items-center justify-between gap-2">
                    <h2 class="font-medium">More results</h2>
                    <Select v-model="language">
                        <SelectTrigger
                            class="w-auto"
                            aria-label="Language"
                            size="sm"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem :value="ANY_LANGUAGE">
                                Any language
                            </SelectItem>
                            <SelectItem
                                v-for="option in SEARCH_LANGUAGES"
                                :key="option.code"
                                :value="option.code"
                            >
                                {{ option.name }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <FormError :message="pickError" />
                <PagedList :list="google" empty-text="Nothing found.">
                    <template #default="{ items }">
                        <ItemGroup>
                            <Item
                                v-for="(result, index) in items"
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
                                            [
                                                result.author,
                                                result.language,
                                                result.year,
                                            ]
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
                    </template>
                </PagedList>
            </section>
        </template>
    </div>
</template>
