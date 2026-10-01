import { ReadingGoalSchema } from '@analog/types';

import { z } from 'zod';

// Number inputs give strings, and an empty box reads as 0.
export const ReadingGoalFormSchema = z.object({
    target: z
        .unknown()
        .transform((value) => Number(value ?? 0))
        .pipe(ReadingGoalSchema.shape.target),
});
