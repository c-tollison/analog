<script setup lang="ts">
import FormError from '@/components/FormError.vue';
import SeriesPicker from '@/components/scan/SeriesPicker.vue';
import { Button } from '@/components/shadcn-components/button';
import { Checkbox } from '@/components/shadcn-components/checkbox';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/shadcn-components/form';
import { Input } from '@/components/shadcn-components/input';
import { Spinner } from '@/components/shadcn-components/spinner';
import { type AdminItem, useUpdateAdminItem } from '@/composables/useAdmin';
import { useAppForm } from '@/composables/useAppForm';
import { AdminItemFormSchema } from '@/lib/admin-schemas';
import { vNoAutofill } from '@/lib/no-autofill';

import { ref } from 'vue';

const props = defineProps<{ item: AdminItem }>();

const update = useUpdateAdminItem();
const saved = ref(false);

const { submit, formError, isSubmitting, fieldProps, values, setFieldValue } =
    useAppForm({
        schema: AdminItemFormSchema,
        initialValues: {
            title: props.item.title,
            isSeries: props.item.seriesId !== null,
            series: props.item.seriesId
                ? {
                      id: props.item.seriesId,
                      title: props.item.seriesTitle ?? '',
                  }
                : null,
            volume: props.item.position ?? '',
        },
        onSubmit: async ({ title, isSeries, series, volume }) => {
            saved.value = false;
            const inSeries = isSeries && series;
            await update.mutateAsync({
                itemId: props.item.id,
                title,
                series: inSeries
                    ? series.id
                        ? { id: series.id }
                        : { title: series.title }
                    : null,
                volume: inSeries ? volume : null,
            });
            saved.value = true;
            return undefined;
        },
    });

function onSeriesToggle(checked: boolean | 'indeterminate') {
    setFieldValue('isSeries', checked === true);
}
</script>

<template>
    <form class="grid gap-4 sm:max-w-md" novalidate @submit="submit">
        <FormError :message="formError" />
        <FormField v-slot="{ componentField }" v-bind="fieldProps" name="title">
            <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                    <Input v-no-autofill v-bind="componentField" />
                </FormControl>
                <FormMessage />
            </FormItem>
        </FormField>
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
        <div class="flex items-center gap-3">
            <Button type="submit" :disabled="isSubmitting">
                <Spinner v-if="isSubmitting" />
                Save
            </Button>
            <span v-if="saved" class="text-muted-foreground text-sm">
                Saved
            </span>
        </div>
    </form>
</template>
