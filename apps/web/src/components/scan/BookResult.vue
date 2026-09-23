<script setup lang="ts">
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import SeriesPicker, {
    type SeriesPick,
} from '@/components/scan/SeriesPicker.vue';
import { Alert, AlertDescription } from '@/components/shadcn-components/alert';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { Checkbox } from '@/components/shadcn-components/checkbox';
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/shadcn-components/form';
import { Input } from '@/components/shadcn-components/input';
import { Spinner } from '@/components/shadcn-components/spinner';
import { useAppForm } from '@/composables/useAppForm';
import type { IsbnLookup } from '@/composables/useCatalog';
import { useAddBook } from '@/composables/useCollections';
import { AddBookFormSchema } from '@/lib/catalog-schemas';
import { SERIES_KIND_LABELS } from '@/lib/media-types';

import { CheckCircleIcon } from '@lucide/vue';
import { computed, ref } from 'vue';

const props = defineProps<{
    lookup: IsbnLookup;
    collectionId: string;
    collectionName: string;
}>();

const emit = defineEmits<{ done: [] }>();

const book = computed(() => props.lookup.book);
const added = ref(false);

const alreadyInCollection = computed(
    () =>
        added.value || props.lookup.inCollectionIds.includes(props.collectionId)
);

function initialSeries(): SeriesPick | null {
    const { suggestedSeries, book } = props.lookup;
    if (suggestedSeries) {
        return { id: suggestedSeries.id, title: suggestedSeries.title };
    }
    return book.series ? { id: null, title: book.series } : null;
}

const startingSeries = initialSeries();

const addBook = useAddBook();

const { submit, formError, isSubmitting, fieldProps, values, setFieldValue } =
    useAppForm({
        schema: AddBookFormSchema,
        initialValues: {
            isSeries: startingSeries !== null,
            series: startingSeries,
            volume: props.lookup.book.volume ?? '',
        },
        onSubmit: async ({ isSeries, series, volume }) => {
            if (!isSeries) {
                series = null;
                volume = null;
            }
            await addBook.mutateAsync({
                collectionId: props.collectionId,
                isbn: book.value.isbn,
                series: series
                    ? series.id
                        ? { id: series.id }
                        : { title: series.title }
                    : null,
                volume,
            });
            added.value = true;
            return undefined;
        },
    });

function onSeriesToggle(checked: boolean | 'indeterminate') {
    setFieldValue('isSeries', checked === true);

    if (checked !== true) {
        setFieldValue('volume', '');
    }
}
</script>

<template>
    <section class="grid gap-4">
        <div class="flex gap-4">
            <CoverImage
                size="md"
                :src="book.coverUrl"
                :alt="`Cover of ${book.title}`"
                class="h-36 w-24 shrink-0"
            />
            <div class="grid content-start gap-1 text-sm">
                <p class="font-medium">{{ book.title }}</p>
                <p v-if="book.authors.length" class="text-muted-foreground">
                    {{ book.authors.join(', ') }}
                </p>
                <p class="text-muted-foreground text-xs">
                    {{
                            [book.publishers[0], book.publishDate]
                                .filter(Boolean)
                                .join(' · ')
                    }}
                </p>
                <p class="text-muted-foreground text-xs">
                    ISBN {{ book.isbn }}
                </p>
                <div class="flex gap-1">
                    <Badge variant="secondary">
                        {{ SERIES_KIND_LABELS[book.kind] }}
                    </Badge>
                    <Badge v-if="alreadyInCollection">
                        In {{ collectionName }}
                    </Badge>
                </div>
            </div>
        </div>

        <form
            v-if="!alreadyInCollection"
            class="grid gap-4"
            novalidate
            @submit="submit"
        >
            <FormError :message="formError" />
            <FormField v-slot="{ value }" name="isSeries" type="checkbox">
                <FormItem class="flex items-center gap-2">
                    <FormControl>
                        <Checkbox
                            :model-value="value"
                            @update:model-value="onSeriesToggle"
                        />
                    </FormControl>
                    <FormLabel>Part of a series</FormLabel>
                </FormItem>
            </FormField>
            <template v-if="values.isSeries">
                <FormField
                    v-slot="{ componentField }"
                    v-bind="fieldProps"
                    name="series"
                >
                    <FormItem>
                        <FormLabel>Series</FormLabel>
                        <FormControl>
                            <SeriesPicker v-bind="componentField" />
                        </FormControl>
                        <FormDescription>
                            Be as specific as possible and include the edition
                            and language. For example, “Fullmetal Alchemist
                            (3-in-1 Edition, English)” and “Fullmetal Alchemist
                            (English)” are separate series.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                </FormField>
                <FormField
                    v-slot="{ componentField }"
                    v-bind="fieldProps"
                    name="volume"
                >
                    <FormItem class="w-24">
                        <FormLabel>Volume</FormLabel>
                        <FormControl>
                            <Input
                                type="number"
                                inputmode="decimal"
                                min="0"
                                step="any"
                                v-bind="componentField"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                </FormField>
            </template>
            <Button type="submit" :disabled="isSubmitting">
                <Spinner v-if="isSubmitting" />
                Add to {{ collectionName }}
            </Button>
        </form>

        <Alert v-if="added">
            <CheckCircleIcon />
            <AlertDescription>
                Added to {{ collectionName }}.
            </AlertDescription>
        </Alert>

        <Button variant="outline" @click="emit('done')">Scan another</Button>
    </section>
</template>
