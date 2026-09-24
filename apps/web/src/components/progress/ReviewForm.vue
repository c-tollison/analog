<script setup lang="ts">
import FormError from '@/components/FormError.vue';
import StarRating from '@/components/progress/StarRating.vue';
import { Button } from '@/components/shadcn-components/button';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/shadcn-components/form';
import { Spinner } from '@/components/shadcn-components/spinner';
import { Textarea } from '@/components/shadcn-components/textarea';
import { useAppForm } from '@/composables/useAppForm';
import { useSaveReview } from '@/composables/useProgress';
import { ReviewSchema } from '@/lib/catalog-schemas';

const props = defineProps<{
    catalogItemId: string;
    rating: number | null;
    review: string | null;
    canCancel: boolean;
}>();

const emit = defineEmits<{ done: [] }>();

const saveReview = useSaveReview();

const { submit, formError, isSubmitting, fieldProps, values, setFieldValue } =
    useAppForm({
        schema: ReviewSchema,
        initialValues: { rating: props.rating, review: props.review ?? '' },
        onSubmit: async (values) => {
            await saveReview.mutateAsync({
                catalogItemId: props.catalogItemId,
                ...values,
            });
            emit('done');
            return undefined;
        },
    });
</script>

<template>
    <form class="grid gap-3" novalidate @submit="submit">
        <FormError :message="formError" />
        <FormField name="rating">
            <FormItem>
                <FormLabel>Your rating</FormLabel>
                <FormControl>
                    <StarRating
                        class="-ml-1.5"
                        :model-value="values.rating"
                        @update:model-value="setFieldValue('rating', $event)"
                    />
                </FormControl>
                <FormMessage />
            </FormItem>
        </FormField>
        <FormField
            v-slot="{ componentField }"
            v-bind="fieldProps"
            name="review"
        >
            <FormItem>
                <FormLabel>Review</FormLabel>
                <FormControl>
                    <Textarea class="min-h-24" v-bind="componentField" />
                </FormControl>
                <FormMessage />
            </FormItem>
        </FormField>
        <div class="flex gap-2">
            <Button type="submit" :disabled="isSubmitting">
                <Spinner v-if="isSubmitting" />
                Save
            </Button>
            <Button
                v-if="canCancel"
                type="button"
                variant="ghost"
                :disabled="isSubmitting"
                @click="emit('done')"
            >
                Cancel
            </Button>
        </div>
    </form>
</template>
