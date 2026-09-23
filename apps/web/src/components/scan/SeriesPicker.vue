<script setup lang="ts">
import CoverImage from '@/components/CoverImage.vue';
import LoadMore from '@/components/lists/LoadMore.vue';
import { Button } from '@/components/shadcn-components/button';
import {
    Combobox,
    ComboboxAnchor,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxViewport,
} from '@/components/shadcn-components/combobox';
import { Spinner } from '@/components/shadcn-components/spinner';
import { useSearchTerm } from '@/composables/useSearchTerm';
import { useSeriesSearch } from '@/composables/useSeries';
import { SERIES_KIND_LABELS } from '@/lib/media-types';

import { PlusIcon, XIcon } from '@lucide/vue';
import { computed, ref, useAttrs, watch } from 'vue';

export type SeriesPick =
    | { id: string; title: string }
    | { id: null; title: string };

const PAGE_SIZE = 20;

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const inputAttrs = computed(() => {
    const { onInput: _onInput, onChange: _onChange, ...rest } = attrs;
    return rest;
});

const model = defineModel<SeriesPick | null>({ default: null });

const search = ref(model.value?.title ?? '');
const { trimmed, term, isTyping } = useSearchTerm(search);

const list = useSeriesSearch(term, { limit: PAGE_SIZE, pending: isTyping });

const canCreate = computed(
    () =>
        trimmed.value !== '' &&
        !list.items.some(
            (s) => s.title.toLowerCase() === trimmed.value.toLowerCase()
        )
);

watch(search, (text) => {
    const title = text.trim();
    if (title === (model.value?.title ?? '')) {
        return;
    }
    model.value = title ? { id: null, title } : null;
});

function sameSeries(a: unknown, b: unknown) {
    const x = a as SeriesPick | null;
    const y = b as SeriesPick | null;
    return x?.id === y?.id && x?.title === y?.title;
}
</script>

<template>
    <div class="flex gap-1">
        <Combobox
            v-model="model"
            class="flex-1"
            ignore-filter
            open-on-focus
            :by="sameSeries"
            :reset-search-term-on-blur="false"
        >
            <ComboboxAnchor>
                <ComboboxInput
                    v-bind="inputAttrs"
                    v-model="search"
                    :display-value="(v: SeriesPick | null) => v?.title ?? ''"
                    placeholder="Search or create a series…"
                />
            </ComboboxAnchor>
            <ComboboxList>
                <ComboboxViewport>
                    <div
                        v-if="list.isLoading && !list.items.length"
                        class="flex justify-center py-2"
                    >
                        <Spinner />
                    </div>
                    <p
                        v-else-if="!list.items.length && !canCreate"
                        class="text-muted-foreground py-2 text-center text-xs"
                    >
                        Type a name to search or create a series.
                    </p>
                    <ComboboxItem
                        v-if="canCreate"
                        :value="{ id: null, title: trimmed }"
                    >
                        <PlusIcon />
                        Create “{{ trimmed }}”
                    </ComboboxItem>
                    <ComboboxItem
                        v-for="series in list.items"
                        :key="series.id"
                        :value="{ id: series.id, title: series.title }"
                    >
                        <CoverImage
                            size="sm"
                            :src="series.coverUrl"
                            alt=""
                            class="h-8 w-6 shrink-0 [&_svg]:size-3"
                        />
                        <span class="flex-1 truncate">{{ series.title }}</span>
                        <span class="text-muted-foreground">
                            {{ SERIES_KIND_LABELS[series.kind] }}
                        </span>
                    </ComboboxItem>
                    <LoadMore
                        v-if="list.items.length"
                        :has-more="list.hasMore"
                        :loading="list.isLoadingMore"
                        @load="list.loadMore"
                    />
                </ComboboxViewport>
            </ComboboxList>
        </Combobox>
        <Button
            v-if="model"
            variant="ghost"
            size="icon"
            aria-label="Clear series"
            @click="
                model = null;
                search = '';
            "
        >
            <XIcon />
        </Button>
    </div>
</template>
