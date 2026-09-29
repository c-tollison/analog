<script setup lang="ts">
import TitleInput from '@/components/admin/TitleInput.vue';
import FormError from '@/components/FormError.vue';
import SeriesPicker, {
    type SeriesPick,
} from '@/components/scan/SeriesPicker.vue';
import { Button } from '@/components/shadcn-components/button';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/shadcn-components/form';
import { Input } from '@/components/shadcn-components/input';
import { Spinner } from '@/components/shadcn-components/spinner';
import WithTooltip from '@/components/WithTooltip.vue';
import { type AdminItem, useUpdateAdminItem } from '@/composables/useAdmin';
import { useAppForm } from '@/composables/useAppForm';
import { AdminItemFormSchema } from '@/lib/admin-schemas';
import { vNoAutofill } from '@/lib/no-autofill';

import { ArrowUpRightIcon } from '@lucide/vue';
import { ref, watch } from 'vue';

// The item's title, series and volume, edited in place. Changes save when a
// box is left or a series is picked.
const props = defineProps<{ item: AdminItem }>();

const update = useUpdateAdminItem();

function savedSeries(): SeriesPick | null {
    return props.item.seriesId
        ? { id: props.item.seriesId, title: props.item.seriesTitle ?? '' }
        : null;
}

// What the picker shows, which can be a name still being typed.
const picked = ref(savedSeries());
// The series to save, which only changes once one is picked.
const series = ref(savedSeries());

// A series made from a typed name gets its id once it's saved.
watch(
    () => props.item.seriesId,
    () => {
        series.value = savedSeries();
        picked.value = savedSeries();
    }
);

const { submit, formError, isSubmitting, fieldProps, values } = useAppForm({
    schema: AdminItemFormSchema,
    initialValues: {
        title: props.item.title,
        volume: props.item.position ?? '',
    },
    onSubmit: async ({ title, volume }) => {
        const choice = series.value;
        await update.mutateAsync({
            itemId: props.item.id,
            title,
            series: choice
                ? choice.id
                    ? { id: choice.id }
                    : { title: choice.title }
                : null,
            volume: choice ? volume : null,
        });
        return undefined;
    },
});

function saveIfChanged() {
    if (
        values.title !== props.item.title ||
        String(values.volume ?? '') !== String(props.item.position ?? '')
    ) {
        submit();
    }
}

function onPick() {
    series.value = picked.value;
    submit();
}
</script>

<template>
    <form class="grid gap-2" novalidate @submit.prevent="saveIfChanged">
        <FormError :message="formError" />
        <FormField v-slot="{ componentField }" v-bind="fieldProps" name="title">
            <FormItem>
                <FormControl>
                    <TitleInput
                        v-bind="componentField"
                        aria-label="Title"
                        class="text-2xl font-semibold md:text-2xl"
                        @blur="saveIfChanged"
                    />
                </FormControl>
                <FormMessage />
            </FormItem>
        </FormField>
        <div class="flex flex-wrap items-center gap-2">
            <div class="flex min-w-60 flex-1 items-center gap-1">
                <div class="flex-1">
                    <SeriesPicker
                        v-model="picked"
                        admin
                        aria-label="Series"
                        @pick="onPick"
                    />
                </div>
                <WithTooltip v-if="item.seriesId" label="Open series page">
                    <Button
                        variant="ghost"
                        size="icon"
                        as-child
                        aria-label="Open series page"
                    >
                        <RouterLink
                            :to="{
                                name: 'admin-series',
                                params: { id: item.seriesId },
                            }"
                        >
                            <ArrowUpRightIcon />
                        </RouterLink>
                    </Button>
                </WithTooltip>
            </div>
            <FormField
                v-if="series"
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="volume"
            >
                <FormItem class="flex items-center gap-2">
                    <FormLabel>Vol.</FormLabel>
                    <FormControl>
                        <Input
                            type="number"
                            inputmode="decimal"
                            v-no-autofill
                            min="0"
                            step="any"
                            class="w-20"
                            v-bind="componentField"
                            @blur="saveIfChanged"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>
            <Spinner v-if="isSubmitting" />
        </div>
    </form>
</template>
