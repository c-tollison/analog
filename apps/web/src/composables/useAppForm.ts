import { GENERIC_ERROR_MESSAGE } from '@analog/types';
import { ApiError } from '@/lib/api';

import { toTypedSchema } from '@vee-validate/zod';
import { type FormOptions, type GenericObject, useForm } from 'vee-validate';
import { computed, ref } from 'vue';
import type { ZodType, z } from 'zod';

type FormValuesSchema = ZodType<GenericObject, GenericObject>;

type InitialValues<TValues extends GenericObject> = NonNullable<
    FormOptions<TValues>['initialValues']
>;

export interface UseAppFormOptions<Schema extends FormValuesSchema> {
    schema: Schema;
    initialValues: InitialValues<z.input<Schema>>;
    // Runs only once the schema passes
    onSubmit: (values: z.output<Schema>) => Promise<string | undefined>;
}

/**
 * Wraps vee-validate so every form in the app gets the same three states:
 * per-field errors from zod, a single form-level error, and isSubmitting.
 */
export function useAppForm<Schema extends FormValuesSchema>({
    schema,
    initialValues,
    onSubmit,
}: UseAppFormOptions<Schema>) {
    const formError = ref<string | null>(null);

    const { handleSubmit, isSubmitting, submitCount, values, setFieldValue } =
        useForm<z.input<Schema>, z.output<Schema>>({
            validationSchema: toTypedSchema<
                Schema,
                z.output<Schema>,
                z.input<Schema>
            >(schema),
            initialValues,
        });

    const fieldProps = computed(() => ({
        validateOnModelUpdate: submitCount.value > 0,
    }));

    const submit = handleSubmit(async (validated) => {
        formError.value = null;
        try {
            const message = await onSubmit(validated);
            if (message) {
                formError.value = message;
            }
        } catch (error) {
            formError.value =
                error instanceof ApiError
                    ? error.message
                    : GENERIC_ERROR_MESSAGE;
        }
    });

    return {
        submit,
        formError,
        isSubmitting,
        fieldProps,
        values,
        setFieldValue,
    };
}
