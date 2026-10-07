<script setup lang="ts">
import {
    Combobox,
    ComboboxAnchor,
    ComboboxEmpty,
    ComboboxGroup,
    ComboboxItem,
    ComboboxList,
    ComboboxViewport,
} from '@/components/shadcn-components/combobox';
import {
    TagsInput,
    TagsInputInput,
    TagsInputItem,
    TagsInputItemDelete,
    TagsInputItemText,
} from '@/components/shadcn-components/tags-input';
import { type Genre, useGenres } from '@/composables/useGenres';

import { ComboboxInput } from 'reka-ui';
import { computed, ref } from 'vue';

// Genres by slug, picked by searching their names. Subgenres sit under their
// parent.
const model = defineModel<string[]>({ default: () => [] });

defineProps<{ placeholder?: string }>();

const { data: genres } = useGenres();

const open = ref(false);
const search = ref('');

const names = computed(
    () => new Map((genres.value ?? []).map((genre) => [genre.slug, genre.name]))
);

function chipText(slug: unknown): string {
    return (typeof slug === 'string' && names.value.get(slug)) || String(slug);
}

// Each top-level genre, then its subgenres.
function inOrder(list: Genre[]): Genre[] {
    const top = list.filter((genre) => !genre.parentSlug);
    return top.flatMap((parent) => [
        parent,
        ...list.filter((genre) => genre.parentSlug === parent.slug),
    ]);
}

const groups = computed(() => {
    const text = search.value.trim().toLowerCase();
    const list = (genres.value ?? []).filter(
        (genre) =>
            !model.value.includes(genre.slug) &&
            (!text || genre.name.toLowerCase().includes(text))
    );
    // While searching, a subgenre shows even when its parent doesn't match.
    const ordered = text ? list : inOrder(list);
    return [
        { heading: 'Fiction', items: ordered.filter((g) => !g.nonfiction) },
        { heading: 'Nonfiction', items: ordered.filter((g) => g.nonfiction) },
    ].filter((group) => group.items.length);
});

function add(slug: string) {
    model.value = [...model.value, slug];
    search.value = '';
}
</script>

<template>
    <Combobox
        v-model:open="open"
        ignore-filter
        :reset-search-term-on-blur="false"
    >
        <ComboboxAnchor as-child>
            <TagsInput v-model="model" class="w-full" :display-value="chipText">
                <TagsInputItem v-for="slug in model" :key="slug" :value="slug">
                    <TagsInputItemText />
                    <TagsInputItemDelete />
                </TagsInputItem>
                <ComboboxInput v-model="search" as-child>
                    <TagsInputInput
                        :placeholder="placeholder"
                        @keydown.enter.prevent
                        @focus="open = true"
                    />
                </ComboboxInput>
            </TagsInput>
        </ComboboxAnchor>
        <ComboboxList class="w-(--reka-popper-anchor-width)">
            <ComboboxViewport class="max-h-72 p-1">
                <ComboboxEmpty>No genre found.</ComboboxEmpty>
                <ComboboxGroup
                    v-for="group in groups"
                    :key="group.heading"
                    :heading="group.heading"
                >
                    <ComboboxItem
                        v-for="genre in group.items"
                        :key="genre.slug"
                        :value="genre.slug"
                        :class="{ 'pl-6': genre.parentSlug && !search }"
                        @select.prevent="add(genre.slug)"
                    >
                        {{ genre.name }}
                    </ComboboxItem>
                </ComboboxGroup>
            </ComboboxViewport>
        </ComboboxList>
    </Combobox>
</template>
