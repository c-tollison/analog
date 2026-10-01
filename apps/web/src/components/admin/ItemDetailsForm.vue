<script setup lang="ts">
import FormError from '@/components/FormError.vue';
import { Button } from '@/components/shadcn-components/button';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/shadcn-components/form';
import { Input } from '@/components/shadcn-components/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/shadcn-components/select';
import { Spinner } from '@/components/shadcn-components/spinner';
import { Textarea } from '@/components/shadcn-components/textarea';
import { type AdminItem, useUpdateItemDetails } from '@/composables/useAdmin';
import { useAppForm } from '@/composables/useAppForm';
import { ItemDetailsFormSchema } from '@/lib/admin-schemas';
import { SERIES_KIND_LABELS } from '@/lib/media-types';
import { vNoAutofill } from '@/lib/no-autofill';

import { ref } from 'vue';

// The book's details that aren't one ISBN's. Lists are typed with commas.
const props = defineProps<{ item: AdminItem }>();

const update = useUpdateItemDetails();
const saved = ref(false);

function splitList(text: string): string[] {
    return text
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);
}

const { submit, formError, isSubmitting, fieldProps } = useAppForm({
    schema: ItemDetailsFormSchema,
    initialValues: {
        kind: props.item.kind ?? undefined,
        authors: props.item.authors.join(', '),
        genres: props.item.genres.join(', '),
        characters: props.item.characters.join(', '),
        description: props.item.description ?? '',
        publishDate: props.item.publishDate ?? '',
        firstPublishYear: props.item.firstPublishYear ?? '',
        pageCount: props.item.pageCount ?? '',
        editionName: props.item.editionName ?? '',
        goodreadsId: props.item.goodreadsId ?? '',
    },
    onSubmit: async ({ kind, authors, genres, characters, ...values }) => {
        saved.value = false;
        await update.mutateAsync({
            itemId: props.item.id,
            ...values,
            // A series sets the kind of its items.
            kind: props.item.seriesId ? undefined : kind,
            authors: splitList(authors),
            genres: splitList(genres),
            characters: splitList(characters),
            goodreadsId: values.goodreadsId || null,
        });
        saved.value = true;
        return undefined;
    },
});
</script>

<template>
    <form class="grid gap-4" novalidate @submit="submit">
        <FormError :message="formError" />
        <div class="grid gap-4 sm:grid-cols-2">
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="authors"
            >
                <FormItem>
                    <FormLabel>Authors</FormLabel>
                    <FormControl>
                        <Input v-no-autofill v-bind="componentField" />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
            <FormField
                v-if="!item.seriesId"
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="kind"
            >
                <FormItem>
                    <FormLabel>Kind</FormLabel>
                    <Select v-bind="componentField">
                        <FormControl>
                            <SelectTrigger class="w-full">
                                <SelectValue placeholder="Not set" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem
                                v-for="(label, value) in SERIES_KIND_LABELS"
                                :key="value"
                                :value="value"
                            >
                                {{ label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            </FormField>
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="genres"
            >
                <FormItem>
                    <FormLabel>Genres</FormLabel>
                    <FormControl>
                        <Input v-no-autofill v-bind="componentField" />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="characters"
            >
                <FormItem>
                    <FormLabel>Characters</FormLabel>
                    <FormControl>
                        <Input v-no-autofill v-bind="componentField" />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
        </div>

        <FormField
            v-slot="{ componentField }"
            v-bind="fieldProps"
            name="description"
        >
            <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                    <Textarea class="min-h-32" v-bind="componentField" />
                </FormControl>
                <FormMessage />
            </FormItem>
        </FormField>

        <div class="grid gap-4 sm:grid-cols-2">
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="firstPublishYear"
            >
                <FormItem>
                    <FormLabel>First published</FormLabel>
                    <FormControl>
                        <Input
                            type="number"
                            inputmode="numeric"
                            v-no-autofill
                            min="0"
                            placeholder="Year"
                            v-bind="componentField"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="publishDate"
            >
                <FormItem>
                    <FormLabel>This edition</FormLabel>
                    <FormControl>
                        <Input v-no-autofill v-bind="componentField" />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="pageCount"
            >
                <FormItem>
                    <FormLabel>Pages</FormLabel>
                    <FormControl>
                        <Input
                            type="number"
                            inputmode="numeric"
                            v-no-autofill
                            min="1"
                            v-bind="componentField"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="editionName"
            >
                <FormItem>
                    <FormLabel>Edition name</FormLabel>
                    <FormControl>
                        <Input v-no-autofill v-bind="componentField" />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="goodreadsId"
            >
                <FormItem>
                    <FormLabel>Goodreads id</FormLabel>
                    <FormControl>
                        <Input
                            inputmode="numeric"
                            v-no-autofill
                            v-bind="componentField"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
        </div>

        <div class="flex items-center gap-3">
            <Button type="submit" :disabled="isSubmitting">
                <Spinner v-if="isSubmitting" />
                Save details
            </Button>
            <p
                v-if="saved && !isSubmitting"
                class="text-sm text-muted-foreground"
            >
                Saved
            </p>
        </div>
    </form>
</template>
