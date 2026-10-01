<script setup lang="ts">
import FormError from '@/components/FormError.vue';
import BarcodeCamera from '@/components/scan/BarcodeCamera.vue';
import BookResult from '@/components/scan/BookResult.vue';
import { Alert, AlertDescription } from '@/components/shadcn-components/alert';
import { Button } from '@/components/shadcn-components/button';
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
import type { CollectionSummary } from '@/composables/useCollections';
import { IsbnLookupFormSchema } from '@/lib/catalog-schemas';
import { vNoAutofill } from '@/lib/no-autofill';

import { CheckCircleIcon, CircleAlertIcon } from '@lucide/vue';
import { computed, ref } from 'vue';
import type { BarcodeFormat } from 'vue-qrcode-reader';

const props = defineProps<{
    formats: BarcodeFormat[];
    collection?: Pick<CollectionSummary, 'id' | 'name'>;
}>();

const lookupIsbn = useIsbnLookup();

const lookup = ref<IsbnLookup | null>(null);
const lastAdded = ref<string | null>(null);
const camera = ref<{ cooldown: () => void }>();

// Camera scans fill in the same field and submit, so both paths share one
// validation and error display.
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
        lookup.value = await lookupIsbn(isbn);
        lastAdded.value = null;
        return undefined;
    },
});

// Only the result shows until it's added or dismissed. The camera stays on
// behind it so the next scan is instant, but scans are ignored until then.
// It's never paused, because pausing turns the camera off.
const showingResult = computed(() => lookup.value !== null);
const hideCamera = computed(() => showingResult.value || isSubmitting.value);

function onDetect(isbn: string) {
    if (isSubmitting.value || showingResult.value) {
        return;
    }
    setFieldValue('isbn', isbn);
    void submit();
}

function onAdded() {
    lastAdded.value = lookup.value?.book.title ?? null;
    scanAnother();
}

function scanAnother() {
    lookup.value = null;
    // The last book may still be in view, so give time to swap it out.
    camera.value?.cooldown();
    resetForm();
}
</script>

<template>
    <!-- The pickers stay up until there's a collection to add to. -->
    <slot v-if="!lookup || !collection" />

    <template v-if="lookup">
        <Alert v-if="!collection">
            <CircleAlertIcon />
            <AlertDescription>
                Choose a shelf to add this to.
            </AlertDescription>
        </Alert>
        <BookResult
            :key="`${lookup.book.isbn}:${collection?.id}`"
            :lookup="lookup"
            :collection="collection ?? null"
            @done="scanAnother"
            @added="onAdded"
        />
    </template>
    <Alert v-else-if="lastAdded && collection">
        <CheckCircleIcon />
        <AlertDescription>
            Added {{ lastAdded }} to {{ collection.name }}.
        </AlertDescription>
    </Alert>

    <div v-if="isSubmitting" class="flex flex-col items-center gap-2 p-8">
        <Spinner class="size-6" />
        <span class="text-muted-foreground text-xs">Looking up…</span>
    </div>
    <BarcodeCamera
        v-show="!hideCamera"
        ref="camera"
        :formats="formats"
        @detect="onDetect"
    />

    <template v-if="!showingResult">
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
</template>
