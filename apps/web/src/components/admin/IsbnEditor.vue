<script setup lang="ts">
import {
    EDITION_FORMAT_LABELS,
    EDITION_ROLES,
    EditionFormat,
    languageName,
    type PersonRole,
} from '@analog/types';
import CreditsPicker from '@/components/admin/CreditsPicker.vue';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
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
    ItemFooter,
    ItemMedia,
    ItemTitle,
} from '@/components/shadcn-components/item';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/shadcn-components/select';
import { Spinner } from '@/components/shadcn-components/spinner';
import { type AdminItem, useUpdateIsbn } from '@/composables/useAdmin';
import { useAppForm } from '@/composables/useAppForm';
import { EditionFormSchema } from '@/lib/admin-schemas';
import { SEARCH_LANGUAGES } from '@/lib/languages';
import { vNoAutofill } from '@/lib/no-autofill';

import { computed, nextTick } from 'vue';

// One ISBN's facts and credits, edited in place. Text saves when a box is
// left, and picks save right away.
const props = defineProps<{
    itemId: string;
    edition: AdminItem['isbns'][number];
}>();

const NOT_SET = 'none';

// The saved language stays pickable when it isn't one of the usual ones.
const languages = computed(() => {
    const code = props.edition.language;
    return code && !SEARCH_LANGUAGES.some((option) => option.code === code)
        ? [...SEARCH_LANGUAGES, { code, name: languageName(code) ?? code }]
        : SEARCH_LANGUAGES;
});

function savedValues() {
    const { edition } = props;
    return {
        title: edition.title ?? '',
        editionName: edition.editionName ?? '',
        format: edition.format ?? NOT_SET,
        publisher: edition.publisher ?? '',
        releaseYear: edition.releaseYear ?? '',
        releaseDate: edition.releaseDate ?? '',
        pageCount: edition.pageCount ?? '',
        language: edition.language ?? NOT_SET,
        goodreadsId: edition.goodreadsId ?? '',
        credits: edition.credits,
    };
}

// Compares as JSON, with numbers as text, since number boxes give strings.
function asText(values: Record<string, unknown>): string {
    return JSON.stringify(
        Object.values(values).map((value) =>
            typeof value === 'number' ? String(value) : (value ?? '')
        )
    );
}

function isEditionCredit(credit: {
    name: string;
    role: PersonRole;
}): credit is { name: string; role: (typeof EDITION_ROLES)[number] } {
    return EDITION_ROLES.some((role) => role === credit.role);
}

const update = useUpdateIsbn();

const { submit, formError, isSubmitting, fieldProps, values } = useAppForm({
    schema: EditionFormSchema,
    initialValues: savedValues(),
    onSubmit: async ({ format, language, releaseDate, credits, ...rest }) => {
        await update.mutateAsync({
            itemId: props.itemId,
            isbn: props.edition.isbn,
            ...rest,
            format:
                Object.values(EditionFormat).find(
                    (value) => value === format
                ) ?? null,
            language: language === NOT_SET ? null : language,
            releaseDate: releaseDate || null,
            credits: credits.filter(isEditionCredit),
            goodreadsId: rest.goodreadsId || null,
        });
        return undefined;
    },
});

function saveIfChanged() {
    if (asText(values) !== asText(savedValues())) {
        submit();
    }
}

async function savePick() {
    await nextTick();
    saveIfChanged();
}
</script>

<template>
    <Item variant="outline" size="sm">
        <ItemMedia>
            <CoverImage
                size="sm"
                :src="edition.coverUrl"
                :alt="edition.title ?? edition.isbn"
                class="aspect-2/3 w-8"
            />
        </ItemMedia>
        <ItemContent class="min-w-0">
            <ItemTitle class="flex items-center gap-2">
                {{ edition.isbn }}
                <Spinner v-if="isSubmitting" />
            </ItemTitle>
        </ItemContent>
        <ItemActions class="flex-wrap">
            <slot />
        </ItemActions>
        <ItemFooter class="grid items-start gap-3 sm:grid-cols-4">
            <FormError class="sm:col-span-4" :message="formError" />
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="title"
            >
                <FormItem class="sm:col-span-2">
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                        <Input
                            v-no-autofill
                            v-bind="componentField"
                            @blur="saveIfChanged"
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
                <FormItem class="sm:col-span-2">
                    <FormLabel>Edition name</FormLabel>
                    <FormControl>
                        <Input
                            v-no-autofill
                            v-bind="componentField"
                            @blur="saveIfChanged"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="format"
            >
                <FormItem>
                    <FormLabel>Format</FormLabel>
                    <Select
                        v-bind="componentField"
                        @update:model-value="savePick"
                    >
                        <FormControl>
                            <SelectTrigger class="w-full">
                                <SelectValue />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem :value="NOT_SET">Not set</SelectItem>
                            <SelectItem
                                v-for="(label, value) in EDITION_FORMAT_LABELS"
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
                name="publisher"
            >
                <FormItem>
                    <FormLabel>Publisher</FormLabel>
                    <FormControl>
                        <Input
                            v-no-autofill
                            v-bind="componentField"
                            @blur="saveIfChanged"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="releaseYear"
            >
                <FormItem>
                    <FormLabel>Year</FormLabel>
                    <FormControl>
                        <Input
                            type="number"
                            inputmode="numeric"
                            v-no-autofill
                            min="0"
                            v-bind="componentField"
                            @blur="saveIfChanged"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="releaseDate"
            >
                <FormItem>
                    <FormLabel>Release date</FormLabel>
                    <FormControl>
                        <Input
                            type="date"
                            v-no-autofill
                            v-bind="componentField"
                            @blur="saveIfChanged"
                        />
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
                            @blur="saveIfChanged"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="language"
            >
                <FormItem>
                    <FormLabel>Language</FormLabel>
                    <Select
                        v-bind="componentField"
                        @update:model-value="savePick"
                    >
                        <FormControl>
                            <SelectTrigger class="w-full">
                                <SelectValue />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem :value="NOT_SET">Not set</SelectItem>
                            <SelectItem
                                v-for="option in languages"
                                :key="option.code"
                                :value="option.code"
                            >
                                {{ option.name }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
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
                            @blur="saveIfChanged"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="credits"
            >
                <FormItem class="sm:col-span-4">
                    <FormLabel>Credits for this edition</FormLabel>
                    <FormControl>
                        <CreditsPicker
                            v-bind="componentField"
                            :roles="EDITION_ROLES"
                            @update:model-value="savePick"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
        </ItemFooter>
    </Item>
</template>
