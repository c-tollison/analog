<script setup lang="ts">
import {
    Combobox,
    ComboboxAnchor,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    ComboboxViewport,
} from '@/components/shadcn-components/combobox';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    TagsInput,
    TagsInputInput,
    TagsInputItem,
    TagsInputItemDelete,
    TagsInputItemText,
} from '@/components/shadcn-components/tags-input';
import { useAdminNameSearch } from '@/composables/useAdmin';
import { useSearchTerm } from '@/composables/useSearchTerm';

import { PlusIcon } from '@lucide/vue';
import { ComboboxInput } from 'reka-ui';
import { computed, ref } from 'vue';

// Names in credit order. Each is a person found by search, or a new name
// that becomes a person when the details are saved.
const model = defineModel<string[]>({ default: () => [] });

defineProps<{ placeholder?: string }>();

const open = ref(false);
const search = ref('');
const { trimmed, term, isTyping } = useSearchTerm(search);
const people = useAdminNameSearch('people', term, { pending: isTyping });

function sameName(a: string, b: string) {
    return a.toLowerCase() === b.toLowerCase();
}

const results = computed(() =>
    people.items.filter(
        (person) => !model.value.some((name) => sameName(name, person.name))
    )
);

const canAdd = computed(
    () =>
        trimmed.value !== '' &&
        !people.items.some((person) => sameName(person.name, trimmed.value)) &&
        !model.value.some((name) => sameName(name, trimmed.value))
);

function add(name: string) {
    model.value = [...model.value, name];
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
            <TagsInput v-model="model" class="w-full">
                <TagsInputItem v-for="name in model" :key="name" :value="name">
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
        <ComboboxList v-if="trimmed" class="w-(--reka-popper-anchor-width)">
            <ComboboxViewport class="p-1">
                <div
                    v-if="people.isLoading && !results.length"
                    class="flex justify-center p-2"
                >
                    <Spinner />
                </div>
                <ComboboxEmpty v-else-if="!canAdd">No one found.</ComboboxEmpty>
                <ComboboxItem
                    v-for="person in results"
                    :key="person.id"
                    :value="person.name"
                    @select.prevent="add(person.name)"
                >
                    {{ person.name }}
                </ComboboxItem>
                <ComboboxItem
                    v-if="canAdd"
                    :value="trimmed"
                    @select.prevent="add(trimmed)"
                >
                    <PlusIcon />
                    Add “{{ trimmed }}”
                </ComboboxItem>
            </ComboboxViewport>
        </ComboboxList>
    </Combobox>
</template>
