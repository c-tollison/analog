import { useState } from 'react';
import type { z } from 'zod';

import { parseZodErrors } from '@/lib/errors';

export function useValidatedSubmit<T>(
    schema: z.ZodType<T>,
    values: unknown,
    onValid: (data: T) => Promise<void>
) {
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    async function onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();

        const result = schema.safeParse(values);
        if (!result.success) {
            setFieldErrors(parseZodErrors(result.error.issues));
            return;
        }

        setFieldErrors({});
        await onValid(result.data);
    }

    return { onSubmit, fieldErrors };
}
