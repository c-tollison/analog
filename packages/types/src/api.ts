import { z } from 'zod';

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

export const ApiErrorResponseSchema = z.object({
    error: z.string(),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
