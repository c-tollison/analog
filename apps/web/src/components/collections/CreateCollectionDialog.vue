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
import { useAppForm } from '@/composables/useAppForm';
import { useCreateCollection } from '@/composables/useCollections';
import { CreateCollectionSchema } from '@/lib/catalog-schemas';

import { watch } from 'vue';

const open = defineModel<boolean>('open', { required: true });

const create = useCreateCollection();

const { submit, formError, isSubmitting, fieldProps, resetForm } = useAppForm({
    schema: CreateCollectionSchema,
    initialValues: { name: '' },
    onSubmit: async (values) => {
        await create.mutateAsync(values);
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
        <DialogContent class="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle>New collection</DialogTitle>
                <DialogDescription>
                    Group things however you like, e.g. Manga or Our DVDs.
                </DialogDescription>
            </DialogHeader>
            <form class="grid gap-4" novalidate @submit="submit">
                <FormError :message="formError" />
                <FormField
                    v-slot="{ componentField }"
                    v-bind="fieldProps"
                    name="name"
                >
                    <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                            <Input
                                autocomplete="off"
                                placeholder="Manga"
                                v-bind="componentField"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                </FormField>
                <DialogFooter>
                    <Button type="submit" :disabled="isSubmitting">
                        <Spinner v-if="isSubmitting" />
                        Create
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</template>
