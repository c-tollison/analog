<script setup lang="ts">
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import SeriesPicker, {
    type SeriesPick,
} from '@/components/scan/SeriesPicker.vue';
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
import { AddBookFormSchema, SeriesPickSchema } from '@/lib/catalog-schemas';
import { SERIES_KIND_LABELS } from '@/lib/media-types';
import { vNoAutofill } from '@/lib/no-autofill';

import { HistoryIcon } from '@lucide/vue';
import { StorageSerializers, useLocalStorage } from '@vueuse/core';
import { computed, ref } from 'vue';

const props = defineProps<{
    lookup: IsbnLookup;
    collectionId: string;
    collectionName: string;
}>();

const emit = defineEmits<{ done: []; added: [] }>();

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

const storedLastSeries = useLocalStorage<SeriesPick | null>(
    'analog:last-series',
    null,
    { serializer: StorageSerializers.object }
);

const lastSeries = computed(() => {
    const parsed = SeriesPickSchema.safeParse(storedLastSeries.value);
    return parsed.success ? parsed.data : null;
});

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
            if (series) {
                storedLastSeries.value = { id: series.id, title: series.title };
            }
            added.value = true;
            emit('added');
            return undefined;
        },
    });

function isSameSeries(a: SeriesPick, b: SeriesPick | null | undefined) {
    if (!b) {
        return false;
    }
    return a.id && b.id
        ? a.id === b.id
        : a.title.toLowerCase() === b.title.toLowerCase();
}

// The last series used, then existing series with titles close to this
// book's. Hides whichever one is already picked.
const seriesOptions = computed(() => {
    const current = values.isSeries ? values.series : null;
    const options = [
        ...(lastSeries.value ? [{ ...lastSeries.value, isLast: true }] : []),
        ...props.lookup.similarSeries.map((s) => ({ ...s, isLast: false })),
    ];
    return options.filter(
        (option, i) =>
            !isSameSeries(option, current) &&
            options.findIndex((o) => isSameSeries(o, option)) === i
    );
});

function pickSeries({ id, title }: SeriesPick) {
    setFieldValue('isSeries', true);
    setFieldValue('series', { id, title });
}

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
            <div v-if="seriesOptions.length" class="grid gap-2">
                <p class="text-muted-foreground text-xs">Suggested series</p>
                <div class="flex flex-wrap gap-2">
                    <Button
                        v-for="option in seriesOptions"
                        :key="option.id ?? option.title"
                        type="button"
                        variant="outline"
                        class="max-w-full"
                        @click="pickSeries(option)"
                    >
                        <HistoryIcon v-if="option.isLast" />
                        <span class="truncate">
                            {{
                                option.isLast
                                    ? `Use last series: ${option.title}`
                                    : option.title
                            }}
                        </span>
                    </Button>
                </div>
            </div>
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
                            Include the edition, and the language if you know
                            it, like "Fullmetal Alchemist (3-in-1 Edition,
                            English)". Each edition is its own series.
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
                                v-no-autofill
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

        <Button variant="outline" @click="emit('done')">Scan another</Button>
    </section>
</template>
