<script setup lang="ts">
import { AUDIENCE_GROUPS, AUDIENCE_LABELS, Audience } from '@analog/types';
import GenrePicker from '@/components/admin/GenrePicker.vue';
import PeoplePicker from '@/components/admin/PeoplePicker.vue';
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
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/shadcn-components/select';
import { Spinner } from '@/components/shadcn-components/spinner';
import { Textarea } from '@/components/shadcn-components/textarea';
import { type AdminItem, useUpdateItemDetails } from '@/composables/useAdmin';
import { useAppForm } from '@/composables/useAppForm';
import { ItemDetailsFormSchema } from '@/lib/admin-schemas';
import { SERIES_KIND_LABELS } from '@/lib/book-labels';
import { vNoAutofill } from '@/lib/no-autofill';

import { ref } from 'vue';

// The book's details that aren't one ISBN's.
const props = defineProps<{ item: AdminItem }>();

const NOT_SET = 'none';

const update = useUpdateItemDetails();
const saved = ref(false);

const { submit, formError, isSubmitting, fieldProps } = useAppForm({
    schema: ItemDetailsFormSchema,
    initialValues: {
        kind: props.item.kind ?? undefined,
        genres: props.item.genres,
        audience: props.item.audience ?? NOT_SET,
        authors: props.item.authors,
        illustrators: props.item.illustrators,
        description: props.item.description ?? '',
        firstPublishedYear: props.item.firstPublishedYear ?? '',
    },
    onSubmit: async ({ kind, audience, ...values }) => {
        saved.value = false;
        await update.mutateAsync({
            itemId: props.item.id,
            ...values,
            // A series sets the kind of its items.
            kind: props.item.seriesId ? undefined : kind,
            audience:
                Object.values(Audience).find((value) => value === audience) ??
                (props.item.seriesId ? props.item.audience : null),
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
                        <PeoplePicker
                            v-bind="componentField"
                            placeholder="Add an author…"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="illustrators"
            >
                <FormItem>
                    <FormLabel>Illustrators</FormLabel>
                    <FormControl>
                        <PeoplePicker
                            v-bind="componentField"
                            placeholder="Add an illustrator…"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="firstPublishedYear"
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
        </div>

        <div class="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="genres"
            >
                <FormItem>
                    <FormLabel>Genres</FormLabel>
                    <FormControl>
                        <GenrePicker
                            v-bind="componentField"
                            placeholder="Add a genre…"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
            <!-- A series sets the audience of its volumes. -->
            <FormField
                v-if="!item.seriesId"
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="audience"
            >
                <FormItem>
                    <FormLabel>Audience</FormLabel>
                    <Select v-bind="componentField">
                        <FormControl>
                            <SelectTrigger class="w-full">
                                <SelectValue />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem :value="NOT_SET">Not set</SelectItem>
                            <SelectGroup
                                v-for="group in AUDIENCE_GROUPS"
                                :key="group.label"
                            >
                                <SelectLabel>{{ group.label }}</SelectLabel>
                                <SelectItem
                                    v-for="value in group.audiences"
                                    :key="value"
                                    :value="value"
                                >
                                    {{ AUDIENCE_LABELS[value] }}
                                </SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
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
