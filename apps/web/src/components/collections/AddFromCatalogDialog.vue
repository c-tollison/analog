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
    useCatalogItems,
} from '@/composables/useCollections';
import { useSearchTerm } from '@/composables/useSearchTerm';
import type { ApiClient } from '@/lib/api';
import { AddCatalogItemsSchema } from '@/lib/catalog-schemas';

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

const search = ref('');
const { term, isTyping } = useSearchTerm(search);

const options = useCatalogItems(
    () => props.collectionId,
    term,
    () => props.series?.id,
    { pending: isTyping }
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
    const next = new Set(selected.value);
    for (const item of addable.value) {
        if (allSelected.value) {
            next.delete(item.id);
        } else {
            next.add(item.id);
        }
    }
    setFieldValue('catalogItemIds', [...next]);
}

const emptyText = computed(() => {
    if (term.value) {
        return 'No titles match.';
    }
    return props.series
        ? 'Nothing catalogued in this series yet.'
        : 'Search by title to see what`s in the catalog.';
});

watch(open, (isOpen) => {
    if (!isOpen) {
        return;
    }
    search.value = '';
    resetForm();
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

            <form
                class="flex min-h-0 flex-1 flex-col gap-3"
                novalidate
                @submit="submit"
            >
                <SearchInput v-model="search" placeholder="Search titles…" />

                <div class="flex min-h-8 items-center gap-2">
                    <p class="flex-1 text-sm font-medium">
                        {{ series?.title }}
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
                            <PagedList :list="options" :empty-text="emptyText">
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
