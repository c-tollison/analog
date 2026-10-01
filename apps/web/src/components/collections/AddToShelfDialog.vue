<script setup lang="ts">
import { MediaFormat, normalizeIsbn } from '@analog/types';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import EditionItem from '@/components/media/EditionItem.vue';
import SearchInput from '@/components/SearchInput.vue';
import BarcodeCamera from '@/components/scan/BarcodeCamera.vue';
import { Button } from '@/components/shadcn-components/button';
import { Checkbox } from '@/components/shadcn-components/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/shadcn-components/dialog';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/shadcn-components/form';
import { Input } from '@/components/shadcn-components/input';
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from '@/components/shadcn-components/item';
import { Label } from '@/components/shadcn-components/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/shadcn-components/select';
import { Spinner } from '@/components/shadcn-components/spinner';
import { useAppForm } from '@/composables/useAppForm';
import {
    useCollections,
    useCreateCollection,
} from '@/composables/useCollections';
import {
    useDisownEdition,
    useItemEditions,
    useOwnEdition,
} from '@/composables/useItems';
import { useSearchTerm } from '@/composables/useSearchTerm';
import { CreateCollectionSchema } from '@/lib/catalog-schemas';
import { isPendingFor } from '@/lib/editions';
import { MEDIA_TYPES } from '@/lib/media-types';
import { vNoAutofill } from '@/lib/no-autofill';

import { ScanBarcodeIcon, XIcon } from '@lucide/vue';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
    catalogItemId: string;
    // Shown for editions with no title of their own.
    title: string;
    // The shelf to start on, like one that already holds the item.
    startShelfId?: string | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const MAX_SHELVES = 100;
const shelves = useCollections(MAX_SHELVES);
const shelfId = ref<string | null>(null);

// Start on the given shelf, or the first one once they load.
watch(
    [open, () => shelves.items],
    ([isOpen, items]) => {
        if (!isOpen) return;
        const known = items.some((shelf) => shelf.id === shelfId.value);
        if (!known) {
            shelfId.value =
                items.find((shelf) => shelf.id === props.startShelfId)?.id ??
                items[0]?.id ??
                null;
        }
    },
    { immediate: true }
);

const hasNoShelves = computed(
    () => !shelves.isLoading && !shelves.error && !shelves.items.length
);

const create = useCreateCollection();
const {
    submit: createShelf,
    formError: createError,
    isSubmitting: isCreating,
    fieldProps,
} = useAppForm({
    schema: CreateCollectionSchema,
    initialValues: { name: '' },
    onSubmit: async (values) => {
        const { id } = await create.mutateAsync(values);
        shelfId.value = id;
        return undefined;
    },
});

const filter = ref('');
const { term, isTyping } = useSearchTerm(filter);
const isScanning = ref(false);

const editions = useItemEditions(() => props.catalogItemId, {
    collectionId: shelfId,
    q: term,
    enabled: () => open.value && !!shelfId.value,
    pending: isTyping,
});

const own = useOwnEdition();
const disown = useDisownEdition();
const isChanging = computed(
    () => own.isPending.value || disown.isPending.value
);

function setOwned(isbn: string, owned: boolean) {
    if (!shelfId.value) return;
    const variables = { collectionId: shelfId.value, isbn };
    if (owned) {
        own.mutate({ ...variables, catalogItemId: props.catalogItemId });
    } else {
        disown.mutate(variables);
    }
}

// A full ISBN that isn't listed can be added as a new edition.
const typedIsbn = computed(() => normalizeIsbn(term.value));
const canAddTyped = computed(
    () =>
        !!typedIsbn.value &&
        !editions.isLoading &&
        !editions.items.some((edition) => edition.isbn === typedIsbn.value)
);

const bookFormats = MEDIA_TYPES.find(
    (type) => type.value === MediaFormat.Book
)?.formats;

function onScan(isbn: string) {
    filter.value = isbn;
    isScanning.value = false;
}

watch(open, (isOpen) => {
    if (isOpen) {
        filter.value = '';
        isScanning.value = false;
        own.reset();
        disown.reset();
    }
});

const error = computed(
    () =>
        (shelves.error ??
            own.error.value?.message ??
            disown.error.value?.message) ||
        null
);
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="flex max-h-[85svh] flex-col sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Add to shelf</DialogTitle>
                <DialogDescription>{{ title }}</DialogDescription>
            </DialogHeader>

            <FormError :message="error" />

            <div v-if="shelves.isLoading" class="flex justify-center p-4">
                <Spinner class="size-6" />
            </div>

            <form
                v-else-if="hasNoShelves"
                class="grid gap-3"
                novalidate
                @submit="createShelf"
            >
                <FormError :message="createError" />
                <FormField
                    v-slot="{ componentField }"
                    v-bind="fieldProps"
                    name="name"
                >
                    <FormItem>
                        <FormLabel>Name your first shelf</FormLabel>
                        <div class="flex gap-2">
                            <FormControl>
                                <Input
                                    v-no-autofill
                                    placeholder="Manga"
                                    v-bind="componentField"
                                />
                            </FormControl>
                            <Button type="submit" :disabled="isCreating">
                                <Spinner v-if="isCreating" />
                                Create
                            </Button>
                        </div>
                        <FormMessage />
                    </FormItem>
                </FormField>
            </form>

            <template v-else>
                <div class="grid gap-1.5">
                    <Label for="shelf">Shelf</Label>
                    <Select v-model="shelfId">
                        <SelectTrigger id="shelf" class="w-full">
                            <SelectValue placeholder="Pick a shelf" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem
                                v-for="shelf in shelves.items"
                                :key="shelf.id"
                                :value="shelf.id"
                            >
                                {{ shelf.name }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div class="flex gap-2">
                    <SearchInput
                        v-model="filter"
                        placeholder="ISBN or publisher"
                    />
                    <Button
                        variant="outline"
                        size="icon"
                        :aria-label="isScanning ? 'Stop scanning' : 'Scan'"
                        @click="isScanning = !isScanning"
                    >
                        <XIcon v-if="isScanning" />
                        <ScanBarcodeIcon v-else />
                    </Button>
                </div>

                <BarcodeCamera
                    v-if="isScanning && bookFormats"
                    :formats="bookFormats"
                    @detect="onScan"
                />

                <div class="min-h-0 overflow-y-auto">
                    <ItemGroup v-if="canAddTyped && typedIsbn" class="mb-2">
                        <Item variant="outline" size="sm">
                            <ItemContent>
                                <ItemTitle>{{ typedIsbn }}</ItemTitle>
                                <ItemDescription>
                                    Not listed yet
                                </ItemDescription>
                            </ItemContent>
                            <ItemActions>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    :disabled="isChanging"
                                    @click="setOwned(typedIsbn, true)"
                                >
                                    <Spinner
                                        v-if="isPendingFor(own, typedIsbn)"
                                    />
                                    Add this edition
                                </Button>
                            </ItemActions>
                        </Item>
                    </ItemGroup>

                    <PagedList
                        :list="editions"
                        :empty-text="
                            term ? 'No editions match.' : 'No editions yet.'
                        "
                    >
                        <template #default="{ items }">
                            <ItemGroup class="grid gap-2">
                                <EditionItem
                                    v-for="edition in items"
                                    :key="edition.isbn"
                                    :edition="edition"
                                    :fallback-title="title"
                                >
                                    <Spinner
                                        v-if="
                                            isPendingFor(own, edition.isbn) ||
                                            isPendingFor(disown, edition.isbn)
                                        "
                                    />
                                    <Checkbox
                                        v-else
                                        :model-value="edition.owned"
                                        :disabled="isChanging"
                                        :aria-label="`Own ${edition.isbn}`"
                                        @update:model-value="
                                            setOwned(edition.isbn, $event === true)
                                        "
                                    />
                                </EditionItem>
                            </ItemGroup>
                        </template>
                    </PagedList>
                </div>
            </template>
        </DialogContent>
    </Dialog>
</template>
