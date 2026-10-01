<script setup lang="ts">
import { languageName } from '@analog/types';
import FormError from '@/components/FormError.vue';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/shadcn-components/select';
import { Spinner } from '@/components/shadcn-components/spinner';
import { useUpdateIsbn } from '@/composables/useAdmin';
import { useAppForm } from '@/composables/useAppForm';
import { EditionFormSchema } from '@/lib/admin-schemas';
import { SEARCH_LANGUAGES } from '@/lib/languages';
import { vNoAutofill } from '@/lib/no-autofill';

import { computed, watch } from 'vue';

const NO_LANGUAGE = 'none';

const props = defineProps<{
    itemId: string;
    edition: {
        isbn: string;
        title: string | null;
        publisher: string | null;
        format: string | null;
        language: string | null;
    };
}>();

const open = defineModel<boolean>('open', { required: true });

// The saved language stays pickable when it isn't one of the usual ones.
const languages = computed(() => {
    const code = props.edition.language;
    return code && !SEARCH_LANGUAGES.some((option) => option.code === code)
        ? [...SEARCH_LANGUAGES, { code, name: languageName(code) ?? code }]
        : SEARCH_LANGUAGES;
});

function startValues() {
    return {
        title: props.edition.title ?? '',
        publisher: props.edition.publisher ?? '',
        format: props.edition.format ?? '',
        language: props.edition.language ?? NO_LANGUAGE,
    };
}

const update = useUpdateIsbn();

const { submit, formError, isSubmitting, fieldProps, resetForm } = useAppForm({
    schema: EditionFormSchema,
    initialValues: startValues(),
    onSubmit: async ({ language, ...values }) => {
        await update.mutateAsync({
            itemId: props.itemId,
            isbn: props.edition.isbn,
            ...values,
            language: language === NO_LANGUAGE ? null : language,
        });
        open.value = false;
        return undefined;
    },
});

watch(open, (isOpen) => {
    if (isOpen) {
        resetForm({ values: startValues() });
    }
});
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Edit edition</DialogTitle>
                <DialogDescription>{{ edition.isbn }}</DialogDescription>
            </DialogHeader>
            <form class="grid gap-4" novalidate @submit="submit">
                <FormError :message="formError" />
                <FormField
                    v-slot="{ componentField }"
                    v-bind="fieldProps"
                    name="title"
                >
                    <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                            <Input v-no-autofill v-bind="componentField" />
                        </FormControl>
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
                            <Input v-no-autofill v-bind="componentField" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                </FormField>
                <div class="grid gap-4 sm:grid-cols-2">
                    <FormField
                        v-slot="{ componentField }"
                        v-bind="fieldProps"
                        name="format"
                    >
                        <FormItem>
                            <FormLabel>Format</FormLabel>
                            <FormControl>
                                <Input
                                    v-no-autofill
                                    placeholder="Paperback"
                                    v-bind="componentField"
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
                            <Select v-bind="componentField">
                                <FormControl>
                                    <SelectTrigger class="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem :value="NO_LANGUAGE">
                                        Not set
                                    </SelectItem>
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
                </div>
                <DialogFooter>
                    <Button type="submit" :disabled="isSubmitting">
                        <Spinner v-if="isSubmitting" />
                        Save
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</template>
