<script setup lang="ts">
import FormError from '@/components/FormError.vue';
import SeriesPicker from '@/components/scan/SeriesPicker.vue';
import { Button } from '@/components/shadcn-components/button';
import {
    Dialog,
    DialogContent,
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
import {
    type AdminSeriesItem,
    useUpdateAdminItem,
} from '@/composables/useAdmin';
import { useAppForm } from '@/composables/useAppForm';
import { ChangeSeriesFormSchema } from '@/lib/admin-schemas';
import { vNoAutofill } from '@/lib/no-autofill';

import { watch } from 'vue';

const props = defineProps<{
    item: AdminSeriesItem;
    // The series it's in now.
    series: { id: string; title: string };
}>();

const open = defineModel<boolean>('open', { required: true });

const update = useUpdateAdminItem();

function startingValues() {
    return {
        series: { id: props.series.id, title: props.series.title },
        volume: props.item.position ?? '',
    };
}

const { submit, formError, isSubmitting, fieldProps, values, resetForm } =
    useAppForm({
        schema: ChangeSeriesFormSchema,
        initialValues: startingValues(),
        onSubmit: async ({ series, volume }) => {
            await update.mutateAsync({
                itemId: props.item.id,
                title: props.item.title,
                series: series
                    ? series.id
                        ? { id: series.id }
                        : { title: series.title }
                    : null,
                volume: series ? volume : null,
            });
            open.value = false;
            return undefined;
        },
    });

watch(open, (isOpen) => {
    if (isOpen) resetForm({ values: startingValues() });
});
</script>

<template>
    <Dialog v-model:open="open">
        <!-- Focusing the picker would open its list over the dialog. -->
        <DialogContent class="sm:max-w-md" @open-auto-focus.prevent>
            <DialogHeader>
                <DialogTitle>Change series for {{ item.title }}</DialogTitle>
            </DialogHeader>
            <form class="grid gap-4" novalidate @submit="submit">
                <FormError :message="formError" />
                <FormField
                    v-slot="{ componentField }"
                    v-bind="fieldProps"
                    name="series"
                >
                    <FormItem>
                        <FormLabel>Series</FormLabel>
                        <FormControl>
                            <SeriesPicker v-bind="componentField" admin />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                </FormField>
                <FormField
                    v-if="values.series"
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
                <DialogFooter>
                    <Button type="submit" :disabled="isSubmitting">
                        <Spinner v-if="isSubmitting" />
                        {{ values.series ? 'Move' : 'Remove from series' }}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</template>
