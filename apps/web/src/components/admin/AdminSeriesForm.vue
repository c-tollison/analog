<script setup lang="ts">
import TitleInput from '@/components/admin/TitleInput.vue';
import FormError from '@/components/FormError.vue';
import { Button } from '@/components/shadcn-components/button';
import {
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from '@/components/shadcn-components/form';
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
import { Spinner } from '@/components/shadcn-components/spinner';
import WithTooltip from '@/components/WithTooltip.vue';
import { type AdminSeries, useUpdateAdminSeries } from '@/composables/useAdmin';
import { useAppForm } from '@/composables/useAppForm';
import { AdminSeriesFormSchema } from '@/lib/admin-schemas';
import { SERIES_KIND_LABELS } from '@/lib/book-labels';

import { InfoIcon } from '@lucide/vue';
import { watch } from 'vue';

// The series' name and kind, edited in place. Changes save when the name box
// is left or a kind is picked.
const props = defineProps<{ series: AdminSeries }>();

const update = useUpdateAdminSeries();

const { submit, formError, isSubmitting, fieldProps, values } = useAppForm({
    schema: AdminSeriesFormSchema,
    initialValues: {
        title: props.series.title,
        kind: props.series.kind,
    },
    onSubmit: async (values) => {
        await update.mutateAsync({ seriesId: props.series.id, ...values });
        return undefined;
    },
});

function saveIfChanged() {
    if (
        values.title !== props.series.title ||
        values.kind !== props.series.kind
    ) {
        submit();
    }
}

watch(() => values.kind, saveIfChanged);
</script>

<template>
    <form class="grid gap-2" novalidate @submit.prevent="saveIfChanged">
        <FormError :message="formError" />
        <div class="flex flex-wrap items-start gap-2">
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="title"
            >
                <FormItem class="min-w-60 flex-1">
                    <FormControl>
                        <TitleInput
                            v-bind="componentField"
                            aria-label="Name"
                            class="text-lg font-semibold md:text-lg"
                            @blur="saveIfChanged"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="kind"
            >
                <FormItem class="flex items-center gap-1 py-1">
                    <Select v-bind="componentField">
                        <FormControl>
                            <SelectTrigger class="w-32" aria-label="Kind">
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
                    <Popover>
                        <WithTooltip label="About kind">
                            <PopoverTrigger as-child>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label="About kind"
                                >
                                    <InfoIcon />
                                </Button>
                            </PopoverTrigger>
                        </WithTooltip>
                        <PopoverContent class="w-64 text-sm">
                            Changing the kind changes it for every book in this
                            series.
                        </PopoverContent>
                    </Popover>
                    <Spinner v-if="isSubmitting" />
                </FormItem>
            </FormField>
        </div>
    </form>
</template>
