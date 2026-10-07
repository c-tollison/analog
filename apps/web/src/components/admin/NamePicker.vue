<script setup lang="ts">
import {
    Combobox,
    ComboboxAnchor,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxViewport,
} from '@/components/shadcn-components/combobox';
import { type NameKind, useAdminNameSearch } from '@/composables/useAdmin';
import { useSearchTerm } from '@/composables/useSearchTerm';

import { computed, ref } from 'vue';

type Name = { id: string; name: string };

// One person or publisher, found by search. `excludeId` leaves one out, like
// the page's own.
const props = defineProps<{
    kind: NameKind;
    excludeId?: string;
    placeholder?: string;
}>();

const model = defineModel<Name | null>({ default: null });

const search = ref('');
const { term, isTyping } = useSearchTerm(search);
const matches = useAdminNameSearch(props.kind, term, { pending: isTyping });
const results = computed(() =>
    matches.items.filter((match) => match.id !== props.excludeId)
);
</script>

<template>
    <Combobox
        v-model="model"
        class="flex-1"
        ignore-filter
        by="id"
        :reset-search-term-on-blur="false"
    >
        <ComboboxAnchor>
            <ComboboxInput
                v-model="search"
                :display-value="(v: Name | null) => v?.name ?? ''"
                :placeholder="placeholder"
            />
        </ComboboxAnchor>
        <ComboboxList v-if="term">
            <ComboboxViewport class="p-1">
                <ComboboxEmpty>Nothing found.</ComboboxEmpty>
                <ComboboxItem
                    v-for="match in results"
                    :key="match.id"
                    :value="match"
                >
                    {{ match.name }}
                </ComboboxItem>
            </ComboboxViewport>
        </ComboboxList>
    </Combobox>
</template>
