<script setup lang="ts">
import type { InferResponseType } from '@analog/api/client';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import SearchInput from '@/components/SearchInput.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { Checkbox } from '@/components/shadcn-components/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/shadcn-components/dialog';
import {
    FormField,
    FormItem,
    FormMessage,
} from '@/components/shadcn-components/form';
import {
    Item,
    ItemActions,
    ItemContent,
    ItemGroup,
    ItemMedia,
    ItemTitle,
} from '@/components/shadcn-components/item';
import { Spinner } from '@/components/shadcn-components/spinner';
import { useAppForm } from '@/composables/useAppForm';
import {
    useAddCollectionItems,
    useCatalogSeriesItems,
} from '@/composables/useCollections';
import { useSearchTerm } from '@/composables/useSearchTerm';
import { useSeriesSearch } from '@/composables/useSeries';
import type { ApiClient } from '@/lib/api';
import { AddCatalogItemsSchema } from '@/lib/catalog-schemas';
import { SERIES_KIND_LABELS } from '@/lib/media-types';

import { ArrowLeftIcon, ChevronRightIcon } from '@lucide/vue';
import { computed, ref, watch } from 'vue';

type Series = InferResponseType<
    ApiClient['series']['$get'],
    200
>['items'][number];

const props = defineProps<{
    collectionId: string;
    collectionName: string;
    series?: Series;
}>();

const open = defineModel<boolean>('open', { required: true });

const selectedSeries = ref<Series | null>(props.series ?? null);
const search = ref('');
const { term, isTyping } = useSearchTerm(search);

const seriesList = useSeriesSearch(term, { pending: isTyping });

const options = useCatalogSeriesItems(
    () => props.collectionId,
    () => selectedSeries.value?.id
);

const addItems = useAddCollectionItems();

const { submit, formError, isSubmitting, values, setFieldValue, resetForm } =
    useAppForm({
        schema: AddCatalogItemsSchema,
        initialValues: { catalogItemIds: [] },
        onSubmit: async (form) => {
            await addItems.mutateAsync({
                collectionId: props.collectionId,
                ...form,
            });
            open.value = false;
            return undefined;
        },
    });

const selected = computed(() => new Set(values.catalogItemIds ?? []));
const addable = computed(() => options.items.filter((i) => !i.inCollection));
const allSelected = computed(
    () =>
        addable.value.length > 0 &&
        addable.value.every((i) => selected.value.has(i.id))
);

function toggle(id: string, checked: boolean | 'indeterminate') {
    const next = new Set(selected.value);
    if (checked === true) {
        next.add(id);
    } else {
        next.delete(id);
    }
    setFieldValue('catalogItemIds', [...next]);
}

function toggleAll() {
    setFieldValue(
        'catalogItemIds',
        allSelected.value ? [] : addable.value.map((i) => i.id)
    );
}

function pickSeries(series: Series | null) {
    selectedSeries.value = series;
    resetForm();
}

watch(open, (isOpen) => {
    if (!isOpen) {
        return;
    }
    search.value = '';
    pickSeries(props.series ?? null);
});
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="flex max-h-[85svh] flex-col sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Add from catalog</DialogTitle>
                <DialogDescription>
                    Add things that are already in the catalog to
                    {{ collectionName }}.
                </DialogDescription>
            </DialogHeader>

            <template v-if="!selectedSeries">
                <SearchInput v-model="search" placeholder="Search series…" />
                <div class="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
                    <PagedList
                        :list="seriesList"
                        :empty-text="
                            term
                                ? 'No series match.'
                                : 'Search for a series to see what’s in the catalog.'
                        "
                    >
                        <template #default="{ items }">
                            <ItemGroup>
                                <Item
                                    v-for="s in items"
                                    :key="s.id"
                                    size="sm"
                                    class="hover:bg-muted text-left"
                                    as-child
                                >
                                    <button
                                        type="button"
                                        @click="pickSeries(s)"
                                    >
                                        <ItemMedia>
                                            <CoverImage
                                                :src="s.coverUrl"
                                                alt=""
                                                size="sm"
                                                class="h-12 w-8"
                                            />
                                        </ItemMedia>
                                        <ItemContent>
                                            <ItemTitle>{{ s.title }}</ItemTitle>
                                        </ItemContent>
                                        <ItemActions>
                                            <Badge variant="secondary">
                                                {{ SERIES_KIND_LABELS[s.kind] }}
                                            </Badge>
                                            <ChevronRightIcon
                                                class="text-muted-foreground size-4"
                                            />
                                        </ItemActions>
                                    </button>
                                </Item>
                            </ItemGroup>
                        </template>
                    </PagedList>
                </div>
            </template>

            <form
                v-else
                class="flex min-h-0 flex-1 flex-col gap-3"
                novalidate
                @submit="submit"
            >
                <div class="flex items-center gap-2">
                    <Button
                        v-if="!series"
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Back to series"
                        @click="pickSeries(null)"
                    >
                        <ArrowLeftIcon />
                    </Button>
                    <p class="flex-1 text-sm font-medium">
                        {{ selectedSeries.title }}
                    </p>
                    <Button
                        v-if="addable.length"
                        type="button"
                        variant="ghost"
                        size="sm"
                        @click="toggleAll"
                    >
                        {{ allSelected ? 'Clear' : 'Select all' }}
                    </Button>
                </div>

                <FormError :message="formError" />

                <FormField name="catalogItemIds">
                    <FormItem class="min-h-0 flex-1">
                        <div class="-mx-1 max-h-[50svh] overflow-y-auto px-1">
                            <PagedList
                                :list="options"
                                empty-text="Nothing catalogued in this series yet."
                            >
                                <template #default="{ items }">
                                    <ItemGroup>
                                        <Item
                                            v-for="item in items"
                                            :key="item.id"
                                            size="sm"
                                            class="hover:bg-muted has-disabled:opacity-60"
                                            as-child
                                        >
                                            <label>
                                                <Checkbox
                                                    :model-value="
                                                        item.inCollection ||
                                                        selected.has(item.id)
                                                    "
                                                    :disabled="item.inCollection"
                                                    @update:model-value="
                                                        (checked) =>
                                                            toggle(
                                                                item.id,
                                                                checked
                                                            )
                                                    "
                                                />
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
                                                        <span
                                                            v-if="
                                                                item.position !==
                                                                null
                                                            "
                                                        >
                                                            Vol.
                                                            {{ item.position }}
                                                            ·
                                                        </span>
                                                        {{ item.title }}
                                                    </ItemTitle>
                                                </ItemContent>
                                                <ItemActions>
                                                    <Badge
                                                        v-if="item.inCollection"
                                                        variant="secondary"
                                                    >
                                                        Owned
                                                    </Badge>
                                                </ItemActions>
                                            </label>
                                        </Item>
                                    </ItemGroup>
                                </template>
                            </PagedList>
                        </div>
                        <FormMessage />
                    </FormItem>
                </FormField>

                <DialogFooter>
                    <Button type="submit" :disabled="isSubmitting">
                        <Spinner v-if="isSubmitting" />
                        Add
                        {{ selected.size ? selected.size : '' }}
                        to {{ collectionName }}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</template>
