import { ProgressStatus } from './catalog-enums.js';
import { z } from 'zod';

export const REVIEW_MAX_LENGTH = 2000;
export const RATING_MAX = 5;

export const SetProgressStatusSchema = z.object({
    status: z.enum(ProgressStatus).nullable(),
});

export const ReviewSchema = z.object({
    rating: z
        .number()
        .int()
        .min(1, `Rating must be 1 to ${RATING_MAX} stars`)
        .max(RATING_MAX, `Rating must be 1 to ${RATING_MAX} stars`)
        .nullable(),
    review: z
        .string()
        .trim()
        .max(
            REVIEW_MAX_LENGTH,
            `Review must be at most ${REVIEW_MAX_LENGTH} characters`
        )
        .transform((value) => value || null)
        .nullable(),
});
