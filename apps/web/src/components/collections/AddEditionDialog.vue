<script setup lang="ts">
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import { Button } from '@/components/shadcn-components/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
    ItemMedia,
    ItemTitle,
} from '@/components/shadcn-components/item';
import { Spinner } from '@/components/shadcn-components/spinner';
import { useAppForm } from '@/composables/useAppForm';
import {
    useAddOwnedEdition,
    useUnownedEditions,
} from '@/composables/useCollections';
import { IsbnLookupFormSchema } from '@/lib/catalog-schemas';
import { editionSummary } from '@/lib/editions';
import { vNoAutofill } from '@/lib/no-autofill';

import { watch } from 'vue';

const props = defineProps<{
    collectionId: string;
    itemId: string;
    // Shown for editions with no title of their own.
    title: string;
}>();

const open = defineModel<boolean>('open', { required: true });

const addEdition = useAddOwnedEdition();

const editions = useUnownedEditions(
    () => props.collectionId,
    () => props.itemId,
    { enabled: open }
);

function addExisting(isbn: string) {
    addEdition.mutate({
        collectionId: props.collectionId,
        itemId: props.itemId,
        isbn,
    });
}

const { submit, formError, isSubmitting, fieldProps, resetForm } = useAppForm({
    schema: IsbnLookupFormSchema,
    initialValues: { isbn: '' },
    onSubmit: async ({ isbn }) => {
        await addEdition.mutateAsync({
            collectionId: props.collectionId,
            itemId: props.itemId,
            isbn,
        });
        open.value = false;
        return undefined;
    },
});

watch(open, (isOpen) => {
    if (isOpen) {
        resetForm();
    }
});
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="flex max-h-[85svh] flex-col sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Add an edition</DialogTitle>
                <DialogDescription>
                    An admin checks new editions before others see them.
                </DialogDescription>
            </DialogHeader>
            <form class="grid gap-4" novalidate @submit="submit">
                <FormError :message="formError" />
                <!-- The field has focus when the dialog opens, so checking on
                     blur would flag it when you pick an edition below. -->
                <FormField
                    v-slot="{ componentField }"
                    v-bind="fieldProps"
                    :validate-on-blur="false"
                    name="isbn"
                >
                    <FormItem>
                        <FormLabel>ISBN</FormLabel>
                        <FormControl>
                            <Input
                                inputmode="numeric"
                                v-no-autofill
                                placeholder="978…"
                                v-bind="componentField"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                </FormField>
                <DialogFooter>
                    <Button type="submit" :disabled="isSubmitting">
                        <Spinner v-if="isSubmitting" />
                        Add
                    </Button>
                </DialogFooter>
            </form>

            <section class="grid min-h-0 gap-2">
                <div class="min-h-0 overflow-y-auto">
                    <PagedList :list="editions" empty-text="No other editions.">
                        <template #default="{ items }">
                            <ItemGroup class="grid gap-2">
                                <Item
                                    v-for="edition in items"
                                    :key="edition.isbn"
                                    variant="outline"
                                    size="sm"
                                >
                                    <ItemMedia>
                                        <CoverImage
                                            size="sm"
                                            :src="edition.coverUrl"
                                            :alt="edition.title ?? title"
                                            class="aspect-2/3 w-8"
                                        />
                                    </ItemMedia>
                                    <ItemContent class="min-w-0">
                                        <ItemTitle class="line-clamp-2">
                                            {{ edition.title ?? title }}
                                        </ItemTitle>
                                        <ItemDescription>
                                            {{ editionSummary(edition) }}
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            :disabled="addEdition.isPending.value"
                                            @click="addExisting(edition.isbn)"
                                        >
                                            <Spinner
                                                v-if="
                                                    addEdition.isPending.value &&
                                                    addEdition.variables.value
                                                        ?.isbn === edition.isbn
                                                "
                                            />
                                            Add
                                        </Button>
                                    </ItemActions>
                                </Item>
                            </ItemGroup>
                        </template>
                    </PagedList>
                </div>
            </section>
        </DialogContent>
    </Dialog>
</template>
