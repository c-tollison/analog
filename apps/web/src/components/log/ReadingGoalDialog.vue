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
import { useRemoveReadingGoal, useSetReadingGoal } from '@/composables/useLog';
import { ReadingGoalFormSchema } from '@/lib/log-schemas';
import { vNoAutofill } from '@/lib/no-autofill';

import { computed, watch } from 'vue';

const props = defineProps<{ year: number; target: number | null }>();

const open = defineModel<boolean>('open', { required: true });

const setGoal = useSetReadingGoal();
const removeGoal = useRemoveReadingGoal();

const { submit, formError, isSubmitting, fieldProps, resetForm } = useAppForm({
    schema: ReadingGoalFormSchema,
    initialValues: { target: props.target ?? '' },
    onSubmit: async ({ target }) => {
        await setGoal.mutateAsync({ year: props.year, target });
        open.value = false;
        return undefined;
    },
});

function onRemove() {
    removeGoal.mutate(props.year, { onSuccess: () => (open.value = false) });
}

const error = computed(
    () => formError.value ?? removeGoal.error.value?.message ?? null
);

watch(open, (isOpen) => {
    if (isOpen) {
        removeGoal.reset();
        resetForm({ values: { target: props.target ?? '' } });
    }
});
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle>{{ year }} goal</DialogTitle>
                <DialogDescription>
                    How many do you want to finish this year? Every volume
                    counts as one.
                </DialogDescription>
            </DialogHeader>
            <form class="grid gap-4" novalidate @submit="submit">
                <FormError :message="error" />
                <FormField
                    v-slot="{ componentField }"
                    v-bind="fieldProps"
                    name="target"
                >
                    <FormItem class="w-32">
                        <FormLabel>Goal</FormLabel>
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
                    <Button
                        v-if="target !== null"
                        type="button"
                        variant="outline"
                        :disabled="removeGoal.isPending.value"
                        @click="onRemove"
                    >
                        <Spinner v-if="removeGoal.isPending.value" />
                        Remove goal
                    </Button>
                    <Button type="submit" :disabled="isSubmitting">
                        <Spinner v-if="isSubmitting" />
                        Save
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</template>
