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
    cancelText: string;
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
                <div class="flex h-6 items-center justify-between">
                    <FormLabel>Your rating</FormLabel>
                    <Button
                        v-if="values.rating !== null"
                        type="button"
                        variant="ghost"
                        size="xs"
                        @click="setFieldValue('rating', null)"
                    >
                        Clear
                    </Button>
                </div>
                <FormControl>
                    <StarRating
                        class="-ml-1"
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
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
                type="button"
                variant="ghost"
                :disabled="isSubmitting"
                @click="emit('done')"
            >
                {{ cancelText }}
            </Button>
            <Button type="submit" :disabled="isSubmitting">
                <Spinner v-if="isSubmitting" />
                Save
            </Button>
        </div>
    </form>
</template>
