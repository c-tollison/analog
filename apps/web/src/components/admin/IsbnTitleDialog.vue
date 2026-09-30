<script setup lang="ts">
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
import { Spinner } from '@/components/shadcn-components/spinner';
import { useUpdateIsbn } from '@/composables/useAdmin';
import { useAppForm } from '@/composables/useAppForm';
import { IsbnTitleFormSchema } from '@/lib/admin-schemas';
import { vNoAutofill } from '@/lib/no-autofill';

import { watch } from 'vue';

const props = defineProps<{
    itemId: string;
    isbn: string;
    title: string | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const update = useUpdateIsbn();

const { submit, formError, isSubmitting, fieldProps, resetForm } = useAppForm({
    schema: IsbnTitleFormSchema,
    initialValues: { title: props.title ?? '' },
    onSubmit: async ({ title }) => {
        await update.mutateAsync({
            itemId: props.itemId,
            isbn: props.isbn,
            title,
        });
        open.value = false;
        return undefined;
    },
});

watch(open, (isOpen) => {
    if (isOpen) {
        resetForm({ values: { title: props.title ?? '' } });
    }
});
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Edit ISBN title</DialogTitle>
                <DialogDescription>{{ isbn }}</DialogDescription>
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
