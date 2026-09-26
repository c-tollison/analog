<script setup lang="ts">
import FormError from '@/components/FormError.vue';
import SeriesPicker from '@/components/scan/SeriesPicker.vue';
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
import { Spinner } from '@/components/shadcn-components/spinner';
import { useMergeSeries } from '@/composables/useAdmin';
import { useAppForm } from '@/composables/useAppForm';
import { MergeSeriesFormSchema } from '@/lib/admin-schemas';

import { watch } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps<{ seriesId: string; seriesTitle: string }>();

const open = defineModel<boolean>('open', { required: true });

const router = useRouter();
const merge = useMergeSeries();

const { submit, formError, isSubmitting, fieldProps, resetForm } = useAppForm({
    schema: MergeSeriesFormSchema,
    initialValues: { into: null },
    onSubmit: async ({ into }) => {
        const intoSeriesId = into?.id;
        if (!intoSeriesId) return 'Pick a series that already exists';
        if (intoSeriesId === props.seriesId) return 'Pick a different series';
        await merge.mutateAsync({ seriesId: props.seriesId, intoSeriesId });
        open.value = false;
        router.replace({ name: 'admin-series', params: { id: intoSeriesId } });
        return undefined;
    },
});

watch(open, (isOpen) => {
    if (isOpen) resetForm({ values: { into: null } });
});
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Merge {{ seriesTitle }}</DialogTitle>
                <DialogDescription>
                    Its items move to the series you pick, and this series is
                    deleted. The series you pick keeps its own name, language
                    and AniList link.
                </DialogDescription>
            </DialogHeader>
            <form class="grid gap-4" novalidate @submit="submit">
                <FormError :message="formError" />
                <FormField
                    v-slot="{ componentField }"
                    v-bind="fieldProps"
                    name="into"
                >
                    <FormItem>
                        <FormLabel>Merge into</FormLabel>
                        <FormControl>
                            <SeriesPicker v-bind="componentField" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                </FormField>
                <DialogFooter>
                    <Button
                        type="submit"
                        variant="destructive"
                        :disabled="isSubmitting"
                    >
                        <Spinner v-if="isSubmitting" />
                        Merge
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</template>
