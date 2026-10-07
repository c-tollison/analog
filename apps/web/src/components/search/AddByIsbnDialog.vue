<script setup lang="ts">
import FormError from '@/components/FormError.vue';
import BarcodeCamera from '@/components/scan/BarcodeCamera.vue';
import BookResult from '@/components/scan/BookResult.vue';
import { Button } from '@/components/shadcn-components/button';
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
import { Spinner } from '@/components/shadcn-components/spinner';
import { useAppForm } from '@/composables/useAppForm';
import { type IsbnLookup, useIsbnLookup } from '@/composables/useCatalog';
import { BOOK_BARCODES } from '@/lib/book-labels';
import { IsbnLookupFormSchema } from '@/lib/catalog-schemas';
import { vNoAutofill } from '@/lib/no-autofill';

import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const open = defineModel<boolean>('open', { required: true });

const router = useRouter();
const lookupIsbn = useIsbnLookup();
const lookup = ref<IsbnLookup | null>(null);

function openItem(id: string) {
    open.value = false;
    void router.push({ name: 'item', params: { id } });
}

// A book that's already placed opens straight away. A new one asks for its
// series and volume first.
const {
    submit,
    formError,
    isSubmitting,
    fieldProps,
    setFieldValue,
    resetForm,
} = useAppForm({
    schema: IsbnLookupFormSchema,
    initialValues: { isbn: '' },
    onSubmit: async ({ isbn }) => {
        const found = await lookupIsbn(isbn);
        if (found.isPlaced) {
            openItem(found.itemId);
        } else {
            lookup.value = found;
        }
        return undefined;
    },
});

function onDetect(isbn: string) {
    if (isSubmitting.value || lookup.value) return;
    setFieldValue('isbn', isbn);
    void submit();
}

watch(open, (isOpen) => {
    if (isOpen) {
        lookup.value = null;
        resetForm();
    }
});
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="flex max-h-[85svh] flex-col sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Add by ISBN</DialogTitle>
                <DialogDescription>
                    Scan the barcode or type the ISBN. New items wait for an
                    admin to check them.
                </DialogDescription>
            </DialogHeader>

            <div class="grid min-h-0 gap-4 overflow-y-auto">
                <BookResult
                    v-if="lookup"
                    :key="lookup.book.isbn"
                    :lookup="lookup"
                    :collection="null"
                    save-only
                    done-text="Back"
                    @done="lookup = null"
                    @saved="openItem($event.itemId)"
                />
                <template v-else>
                    <BarcodeCamera
                        v-show="!isSubmitting"
                        :formats="BOOK_BARCODES"
                        @detect="onDetect"
                    />
                    <div
                        v-if="isSubmitting"
                        class="flex flex-col items-center gap-2 p-8"
                    >
                        <Spinner class="size-6" />
                        <span class="text-muted-foreground text-xs">
                            Looking up…
                        </span>
                    </div>
                    <form class="grid gap-2" novalidate @submit="submit">
                        <FormError :message="formError" />
                        <FormField
                            v-slot="{ componentField }"
                            v-bind="fieldProps"
                            name="isbn"
                        >
                            <FormItem>
                                <FormLabel>ISBN</FormLabel>
                                <div class="flex gap-2">
                                    <FormControl>
                                        <Input
                                            inputmode="numeric"
                                            v-no-autofill
                                            placeholder="978…"
                                            v-bind="componentField"
                                        />
                                    </FormControl>
                                    <Button
                                        type="submit"
                                        variant="outline"
                                        :disabled="isSubmitting"
                                    >
                                        <Spinner v-if="isSubmitting" />
                                        Look up
                                    </Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        </FormField>
                    </form>
                </template>
            </div>
        </DialogContent>
    </Dialog>
</template>
