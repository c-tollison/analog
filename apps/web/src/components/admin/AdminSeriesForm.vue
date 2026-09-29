<script setup lang="ts">
import FormError from '@/components/FormError.vue';
import SaveButton from '@/components/SaveButton.vue';
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
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/shadcn-components/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/shadcn-components/select';
import { type AdminSeries, useUpdateAdminSeries } from '@/composables/useAdmin';
import { useAppForm } from '@/composables/useAppForm';
import { AdminSeriesFormSchema } from '@/lib/admin-schemas';
import { SERIES_KIND_LABELS } from '@/lib/media-types';
import { vNoAutofill } from '@/lib/no-autofill';

import { InfoIcon } from '@lucide/vue';
import { ref } from 'vue';

const props = defineProps<{ series: AdminSeries }>();

const update = useUpdateAdminSeries();
const saved = ref(false);

const { submit, formError, isSubmitting, fieldProps } = useAppForm({
    schema: AdminSeriesFormSchema,
    initialValues: {
        title: props.series.title,
        kind: props.series.kind,
    },
    onSubmit: async (values) => {
        saved.value = false;
        await update.mutateAsync({ seriesId: props.series.id, ...values });
        saved.value = true;
        return undefined;
    },
});
</script>

<template>
    <form class="grid gap-4 sm:max-w-md" novalidate @submit="submit">
        <FormError :message="formError" />
        <FormField v-slot="{ componentField }" v-bind="fieldProps" name="title">
            <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                    <Input v-no-autofill v-bind="componentField" />
                </FormControl>
                <FormMessage />
            </FormItem>
        </FormField>
        <div class="flex flex-wrap items-start gap-4">
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="kind"
            >
                <FormItem>
                    <div class="flex items-center gap-1">
                        <FormLabel>Kind</FormLabel>
                        <Popover>
                            <PopoverTrigger as-child>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    class="-my-1"
                                    aria-label="About kind"
                                >
                                    <InfoIcon />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent class="w-64 text-sm">
                                Changing the kind changes it for every item in
                                this series.
                            </PopoverContent>
                        </Popover>
                    </div>
                    <Select v-bind="componentField">
                        <FormControl>
                            <SelectTrigger class="w-40">
                                <SelectValue />
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
        <SaveButton :pending="isSubmitting" :saved="saved" />
    </form>
</template>
