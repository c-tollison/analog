<script setup lang="ts">
import CoverImage from '@/components/CoverImage.vue';
import LoadMore from '@/components/lists/LoadMore.vue';
import { Button } from '@/components/shadcn-components/button';
import {
    Combobox,
    ComboboxAnchor,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxViewport,
} from '@/components/shadcn-components/combobox';
import { InputGroupAddon } from '@/components/shadcn-components/input-group';
import { Spinner } from '@/components/shadcn-components/spinner';
import WithTooltip from '@/components/WithTooltip.vue';
import { useSearchTerm } from '@/composables/useSearchTerm';
import { useSeriesSearch } from '@/composables/useSeries';
import { SERIES_KIND_LABELS } from '@/lib/book-labels';
import type { AddBookFormSchema } from '@/lib/catalog-schemas';

import { PlusIcon, XIcon } from '@lucide/vue';
import { computed, ref, useAttrs, watch } from 'vue';
import type { z } from 'zod';

export type SeriesPick = NonNullable<
    z.input<typeof AddBookFormSchema>['series']
>;

const PAGE_SIZE = 20;

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const inputAttrs = computed(() => {
    const { onInput: _onInput, onChange: _onChange, ...rest } = attrs;
    return rest;
});

// `admin` picks from every series, for the admin dashboard.
const props = defineProps<{ admin?: boolean }>();

const model = defineModel<SeriesPick | null>({ default: null });

// Fires when a series is picked from the list or cleared, but not while a
// name is being typed.
const emit = defineEmits<{ pick: [] }>();

const search = ref(model.value?.title ?? '');
const { trimmed, term, isTyping } = useSearchTerm(search);

const list = useSeriesSearch(term, {
    limit: PAGE_SIZE,
    pending: isTyping,
    admin: props.admin,
});

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

watch(model, (pick) => {
    const title = pick?.title ?? '';
    if (title !== search.value.trim()) {
        search.value = title;
    }
});

// A typed name joins the series with that exact name when the book is added,
// so pick that series here to show it's not new.
watch(
    () => list.items,
    (items) => {
        const pick = model.value;
        const match =
            pick && !pick.id
                ? items.find(
                      (s) => s.title.toLowerCase() === pick.title.toLowerCase()
                  )
                : undefined;
        if (match) {
            model.value = { id: match.id, title: match.title };
        }
    }
);

// The picked series as the search found it, for its cover and kind. The
// search is its name, so it's in the results.
const pickedSeries = computed(() => {
    const id = model.value?.id;
    return id ? list.items.find((s) => s.id === id) : undefined;
});

function isSeriesPick(value: unknown): value is SeriesPick {
    return typeof value === 'object' && value !== null && 'title' in value;
}

function sameSeries(a: unknown, b: unknown) {
    if (!isSeriesPick(a) || !isSeriesPick(b)) {
        return a === b;
    }
    return a.id === b.id && a.title === b.title;
}
</script>

<template>
    <div class="flex items-center gap-1">
        <Combobox
            v-model="model"
            class="flex-1"
            ignore-filter
            open-on-focus
            :by="sameSeries"
            :reset-search-term-on-blur="false"
            @update:model-value="emit('pick')"
        >
            <ComboboxAnchor>
                <ComboboxInput
                    v-bind="inputAttrs"
                    v-model="search"
                    :display-value="(v: SeriesPick | null) => v?.title ?? ''"
                    placeholder="Search or create a series…"
                    :group-class="model?.id ? 'h-auto' : undefined"
                >
                    <template v-if="model?.id" #start>
                        <InputGroupAddon class="py-1">
                            <CoverImage
                                size="sm"
                                :src="pickedSeries?.coverUrl ?? null"
                                alt=""
                                class="h-8 w-6 shrink-0 [&_svg]:size-3"
                            />
                        </InputGroupAddon>
                    </template>
                    <template v-if="pickedSeries" #end>
                        <InputGroupAddon align="inline-end">
                            {{ SERIES_KIND_LABELS[pickedSeries.kind] }}
                        </InputGroupAddon>
                    </template>
                </ComboboxInput>
            </ComboboxAnchor>
            <ComboboxList>
                <ComboboxViewport>
                    <div
                        v-if="list.isLoading && !list.items.length"
                        class="flex justify-center py-2"
                    >
                        <Spinner />
                    </div>
                    <ComboboxEmpty v-else-if="!list.items.length && !canCreate">
                        Type a name to search or create a series.
                    </ComboboxEmpty>
                    <ComboboxItem
                        v-if="canCreate"
                        :value="{ id: null, title: trimmed }"
                    >
                        <PlusIcon />
                        Create "{{ trimmed }}"
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
        <WithTooltip v-if="model" label="Clear series">
            <Button
                variant="ghost"
                size="icon"
                aria-label="Clear series"
                @click="
                    model = null;
                    search = '';
                    emit('pick');
                "
            >
                <XIcon />
            </Button>
        </WithTooltip>
    </div>
</template>
