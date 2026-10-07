<script setup lang="ts">
import { PERSON_ROLE_LABELS, type PersonRole } from '@analog/types';
import {
    Combobox,
    ComboboxAnchor,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    ComboboxViewport,
} from '@/components/shadcn-components/combobox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/shadcn-components/select';
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

type Credit = { name: string; role: PersonRole };

// People with a role each, in credit order. A role is picked, then a person
// found by search or a new name.
const model = defineModel<Credit[]>({ default: () => [] });

const props = defineProps<{ roles: readonly PersonRole[] }>();

const pickedRole = ref<string>(props.roles[0] ?? '');
const role = computed(() =>
    props.roles.find((value) => value === pickedRole.value)
);

const keyOf = (credit: Credit) => `${credit.role}:${credit.name}`;

// The chips, by key. Removing one drops its credit.
const keys = computed({
    get: () => model.value.map(keyOf),
    set: (next: string[]) => {
        model.value = model.value.filter((credit) =>
            next.includes(keyOf(credit))
        );
    },
});

function chipText(key: unknown): string {
    const credit = model.value.find((item) => keyOf(item) === key);
    return credit
        ? `${credit.name} · ${PERSON_ROLE_LABELS[credit.role]}`
        : String(key);
}

const open = ref(false);
const search = ref('');
const { trimmed, term, isTyping } = useSearchTerm(search);
const people = useAdminNameSearch('people', term, { pending: isTyping });

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const canAdd = computed(
    () =>
        trimmed.value !== '' &&
        !people.items.some((person) => sameName(person.name, trimmed.value))
);

function add(name: string) {
    const credit = role.value && { name, role: role.value };
    if (credit && !model.value.some((item) => keyOf(item) === keyOf(credit))) {
        model.value = [...model.value, credit];
    }
    search.value = '';
}
</script>

<template>
    <div class="flex flex-col gap-2 sm:flex-row">
        <Select v-model="pickedRole">
            <SelectTrigger class="w-full sm:w-36" aria-label="Role">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem v-for="value in roles" :key="value" :value="value">
                    {{ PERSON_ROLE_LABELS[value] }}
                </SelectItem>
            </SelectContent>
        </Select>
        <Combobox
            v-model:open="open"
            class="flex-1"
            ignore-filter
            :reset-search-term-on-blur="false"
        >
            <ComboboxAnchor as-child>
                <TagsInput
                    v-model="keys"
                    class="w-full"
                    :display-value="chipText"
                >
                    <TagsInputItem v-for="key in keys" :key="key" :value="key">
                        <TagsInputItemText />
                        <TagsInputItemDelete />
                    </TagsInputItem>
                    <ComboboxInput v-model="search" as-child>
                        <TagsInputInput
                            placeholder="Add a person…"
                            @keydown.enter.prevent
                            @focus="open = true"
                        />
                    </ComboboxInput>
                </TagsInput>
            </ComboboxAnchor>
            <ComboboxList v-if="trimmed" class="w-(--reka-popper-anchor-width)">
                <ComboboxViewport class="p-1">
                    <div
                        v-if="people.isLoading && !people.items.length"
                        class="flex justify-center p-2"
                    >
                        <Spinner />
                    </div>
                    <ComboboxEmpty v-else-if="!canAdd">
                        No one found.
                    </ComboboxEmpty>
                    <ComboboxItem
                        v-for="person in people.items"
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
    </div>
</template>
