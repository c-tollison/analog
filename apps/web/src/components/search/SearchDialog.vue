<script setup lang="ts">
import type { InferResponseType } from '@analog/api/client';
import { Relationship, USER_SEARCH_MIN_LENGTH } from '@analog/types';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import { navLinks } from '@/components/layout/nav-links';
import { Button } from '@/components/shadcn-components/button';
import {
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/shadcn-components/command';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/shadcn-components/dialog';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/shadcn-components/toggle-group';
import UserAvatar from '@/components/users/UserAvatar.vue';
import { useCollectionSearch } from '@/composables/useCollections';
import { useBookSearch } from '@/composables/useItems';
import type { PaginatedList } from '@/composables/usePaginatedList';
import { useSearchTerm } from '@/composables/useSearchTerm';
import { useSeriesSearch } from '@/composables/useSeries';
import { useUserSearch } from '@/composables/useUsers';
import type { ApiClient } from '@/lib/api';
import { SERIES_KIND_LABELS } from '@/lib/media-types';
import { staggerIn } from '@/lib/motion';
import { useSearchStore } from '@/stores/search';

import {
    ArrowRightIcon,
    ChevronDownIcon,
    ClockIcon,
    PlusIcon,
    XIcon,
} from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { type RouteLocationRaw, useRouter } from 'vue-router';

const KINDS = [
    { value: 'books', label: 'Media', more: 'More media' },
    { value: 'series', label: 'Series', more: 'More series' },
    { value: 'people', label: 'People', more: 'More people' },
    { value: 'shelves', label: 'Shelves', more: 'More from your shelves' },
] as const;

type Kind = (typeof KINDS)[number]['value'];
type Scope = 'all' | Kind;

function isScope(value: unknown): value is Scope {
    return value === 'all' || KINDS.some((kind) => kind.value === value);
}

// All shows a few of each kind. One kind shows a full page.
const PREVIEW_LIMIT = 4;

const RELATIONSHIP_LABELS: Partial<Record<Relationship, string>> = {
    [Relationship.Friends]: 'Friend',
    [Relationship.RequestSent]: 'Requested',
    [Relationship.RequestReceived]: 'Wants to be friends',
};

const search = useSearchStore();
const { isOpen } = storeToRefs(search);
const router = useRouter();

const scope = ref<Scope>('all');
const query = ref('');
const { trimmed, term, isTyping } = useSearchTerm(query);

// One letter matches nearly everything, so nothing searches until two.
const isTooShort = computed(
    () =>
        trimmed.value.length > 0 &&
        trimmed.value.length < USER_SEARCH_MIN_LENGTH
);

// Only the kinds on screen search, and each term loads once.
function listFor(kind: Kind) {
    return {
        enabled: () =>
            isOpen.value &&
            (scope.value === 'all' || scope.value === kind) &&
            term.value.length >= USER_SEARCH_MIN_LENGTH,
        pending: isTyping,
        limit: () => (scope.value === 'all' ? PREVIEW_LIMIT : undefined),
        once: true,
    };
}

const books = useBookSearch(term, listFor('books'));
const series = useSeriesSearch(term, listFor('series'));
const people = useUserSearch(term, listFor('people'));
const shelves = useCollectionSearch(term, listFor('shelves'));

const lists: Record<Kind, PaginatedList<unknown>> = {
    books,
    series,
    people,
    shelves,
};

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

interface Row {
    key: string;
    title: string;
    detail: string;
    to: RouteLocationRaw;
    cover?: string | null;
    person?: { name: string; image: string | null };
}

function details(...parts: (string | null | undefined | false)[]) {
    return parts.filter(Boolean).join(' · ');
}

const rows = computed<Record<Kind, Row[]>>(() => ({
    books: books.items.map((book) => ({
        key: `books:${book.id}`,
        title: book.title,
        detail: details(
            book.seriesTitle &&
                book.position !== null &&
                `#${book.position} in ${book.seriesTitle}`,
            book.author,
            book.releaseDate?.slice(0, 4)
        ),
        to: { name: 'item', params: { id: book.id } },
        cover: book.coverUrl,
    })),
    series: series.items.map((result) => ({
        key: `series:${result.id}`,
        title: result.title,
        detail: details(
            SERIES_KIND_LABELS[result.kind],
            result.volumeCount ? `${result.volumeCount} volumes` : null
        ),
        to: { name: 'series', params: { id: result.id } },
        cover: result.coverUrl,
    })),
    people: people.items.map((person) => ({
        key: `people:${person.id}`,
        title: person.name,
        detail: details(
            `@${person.username}`,
            RELATIONSHIP_LABELS[person.relationship]
        ),
        to: { name: 'user', params: { username: person.username } },
        person,
    })),
    shelves: shelves.items.map((result) => ({
        key: `shelves:${result.id}`,
        title: result.title,
        detail: details(
            result.collectionName,
            result.position !== null && `Vol. ${result.position}`
        ),
        to: shelfLink(result),
        cover: result.coverUrl,
    })),
}));

const sections = computed(() =>
    KINDS.filter(
        (kind) => scope.value === 'all' || scope.value === kind.value
    ).map((kind) => ({
        ...kind,
        list: lists[kind.value],
        rows: rows.value[kind.value],
    }))
);

const isLoading = computed(() =>
    sections.value.some((section) => section.list.isLoading)
);
const hasRows = computed(() =>
    sections.value.some((section) => section.rows.length)
);
const error = computed(
    () =>
        sections.value.map((section) => section.list.error).find(Boolean) ??
        null
);

function go(to: RouteLocationRaw) {
    isOpen.value = false;
    void router.push(to);
}

function openResult(row: Row) {
    search.remember(term.value);
    go(row.to);
}

function setScope(value: unknown) {
    if (isScope(value)) scope.value = value;
}

// Each open starts fresh.
watch(isOpen, (open) => {
    if (!open) return;
    query.value = '';
    scope.value = 'all';
    search.pruneRecent();
});

// New results highlight the top one, so Enter opens it. Load more keeps the
// highlight where it is.
const command = ref<{ highlightFirstItem: () => void }>();
watch(
    () => (isLoading.value ? null : `${scope.value}:${term.value}`),
    (key) => {
        if (key !== null) command.value?.highlightFirstItem();
    }
);
</script>

<template>
    <Dialog v-model:open="isOpen">
        <!-- Full screen on phones, a panel near the top on wider screens. -->
        <DialogContent
            :show-close-button="false"
            class="top-0 left-0 flex h-svh max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:top-[10%] sm:left-1/2 sm:h-128 sm:max-h-[80svh] sm:max-w-xl sm:-translate-x-1/2 sm:rounded-xl"
        >
            <DialogHeader class="sr-only">
                <DialogTitle>Search</DialogTitle>
                <DialogDescription>
                    Search media, series, people and your shelves.
                </DialogDescription>
            </DialogHeader>

            <Command
                ref="command"
                v-model:search="query"
                :should-filter="false"
                class="min-h-0 flex-1 gap-2 rounded-none bg-transparent p-2"
            >
                <div class="grid grid-cols-[1fr_auto] items-end gap-1">
                    <CommandInput placeholder="Title, series, person…" />
                    <DialogClose as-child>
                        <Button
                            variant="ghost"
                            size="icon-lg"
                            aria-label="Close"
                        >
                            <XIcon />
                        </Button>
                    </DialogClose>
                </div>

                <ToggleGroup
                    type="single"
                    variant="outline"
                    :model-value="scope"
                    class="px-1"
                    @update:model-value="setScope"
                >
                    <ToggleGroupItem value="all">All</ToggleGroupItem>
                    <ToggleGroupItem
                        v-for="kind in KINDS"
                        :key="kind.value"
                        :value="kind.value"
                    >
                        {{ kind.label }}
                    </ToggleGroupItem>
                </ToggleGroup>

                <CommandList class="max-h-none min-h-0 flex-1">
                    <template v-if="!trimmed">
                        <CommandGroup
                            v-if="search.recent.length"
                            heading="Recent"
                        >
                            <CommandItem
                                v-for="entry in search.recent"
                                :key="entry.term"
                                :value="`recent:${entry.term}`"
                                @select="query = entry.term"
                            >
                                <ClockIcon />
                                <span class="truncate">{{ entry.term }}</span>
                            </CommandItem>
                            <CommandItem
                                value="recent:clear"
                                class="text-muted-foreground"
                                @select="search.clearRecent()"
                            >
                                <XIcon />
                                Clear recent searches
                            </CommandItem>
                        </CommandGroup>
                        <CommandGroup heading="Go to">
                            <CommandItem
                                v-for="link in navLinks"
                                :key="link.name"
                                :value="`go:${link.name}`"
                                @select="go({ name: link.name })"
                            >
                                <component :is="link.icon" />
                                {{ link.label }}
                            </CommandItem>
                            <CommandItem
                                value="go:add"
                                @select="search.openAdd()"
                            >
                                <PlusIcon />
                                Add by ISBN
                            </CommandItem>
                        </CommandGroup>
                    </template>

                    <p
                        v-else-if="isTooShort"
                        class="text-muted-foreground p-6 text-center"
                    >
                        Type at least {{ USER_SEARCH_MIN_LENGTH }} letters.
                    </p>

                    <template v-else>
                        <FormError :message="error" class="m-1" />

                        <div
                            v-if="isLoading && !hasRows"
                            class="flex justify-center p-8"
                        >
                            <Spinner class="size-6" />
                        </div>
                        <p
                            v-else-if="!isLoading && !error && !hasRows"
                            class="text-muted-foreground motion-safe:animate-in fade-in animation-duration-500 p-6 text-center"
                        >
                            Nothing matches.
                        </p>

                        <div
                            v-if="hasRows"
                            :class="{ 'opacity-60 transition-opacity': isLoading }"
                        >
                            <template
                                v-for="section in sections"
                                :key="section.value"
                            >
                                <CommandGroup
                                    v-if="section.rows.length"
                                    :heading="
                                        scope === 'all' ? section.label : undefined
                                    "
                                >
                                    <CommandItem
                                        v-for="(row, index) in section.rows"
                                        v-bind="staggerIn(index)"
                                        :key="row.key"
                                        :value="row.key"
                                        @select="openResult(row)"
                                    >
                                        <UserAvatar
                                            v-if="row.person"
                                            :name="row.person.name"
                                            :image="row.person.image"
                                        />
                                        <CoverImage
                                            v-else
                                            size="sm"
                                            :src="row.cover ?? null"
                                            :alt="row.title"
                                            class="aspect-2/3 w-8 shrink-0"
                                        />
                                        <div class="grid min-w-0">
                                            <span class="truncate font-medium">
                                                {{ row.title }}
                                            </span>
                                            <span
                                                v-if="row.detail"
                                                class="text-muted-foreground truncate"
                                            >
                                                {{ row.detail }}
                                            </span>
                                        </div>
                                    </CommandItem>
                                    <CommandItem
                                        v-if="scope === 'all' && section.list.hasMore"
                                        :value="`more:${section.value}`"
                                        class="text-muted-foreground"
                                        @select="scope = section.value"
                                    >
                                        <ArrowRightIcon />
                                        {{ section.more }}
                                    </CommandItem>
                                    <CommandItem
                                        v-if="scope !== 'all' && section.list.hasMore"
                                        :value="`load:${section.value}`"
                                        class="text-muted-foreground"
                                        @select="section.list.loadMore()"
                                    >
                                        <Spinner
                                            v-if="section.list.isLoadingMore"
                                        />
                                        <ChevronDownIcon v-else />
                                        Load more
                                    </CommandItem>
                                </CommandGroup>
                            </template>
                        </div>

                        <CommandGroup v-if="!isLoading">
                            <CommandItem
                                value="go:add"
                                @select="search.openAdd()"
                            >
                                <PlusIcon />
                                Not here? Add by ISBN
                            </CommandItem>
                        </CommandGroup>
                    </template>
                </CommandList>
            </Command>
        </DialogContent>
    </Dialog>
</template>
