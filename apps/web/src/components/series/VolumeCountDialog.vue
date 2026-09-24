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
import { useSetVolumeCount } from '@/composables/useSeries';
import { VolumeCountFormSchema } from '@/lib/catalog-schemas';
import { vNoAutofill } from '@/lib/no-autofill';

import { watch } from 'vue';

const props = defineProps<{
    seriesId: string;
    volumeCount: number | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const setVolumeCount = useSetVolumeCount();

const { submit, formError, isSubmitting, fieldProps, resetForm } = useAppForm({
    schema: VolumeCountFormSchema,
    initialValues: { volumeCount: props.volumeCount ?? '' },
    onSubmit: async ({ volumeCount }) => {
        await setVolumeCount.mutateAsync({
            seriesId: props.seriesId,
            volumeCount,
        });
        open.value = false;
        return undefined;
    },
});

watch(open, (isOpen) => {
    if (isOpen) {
        resetForm({ values: { volumeCount: props.volumeCount ?? '' } });
    }
});
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle>Total volumes</DialogTitle>
                <DialogDescription class="sr-only">
                    Set how many volumes this series has
                </DialogDescription>
            </DialogHeader>
            <form class="grid gap-4" novalidate @submit="submit">
                <FormError :message="formError" />
                <FormField
                    v-slot="{ componentField }"
                    v-bind="fieldProps"
                    name="volumeCount"
                >
                    <FormItem class="w-32">
                        <FormLabel>Volumes</FormLabel>
                        <FormControl>
                            <Input
                                type="number"
                                inputmode="numeric"
                                v-no-autofill
                                min="1"
                                step="1"
                                v-bind="componentField"
                            />
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
