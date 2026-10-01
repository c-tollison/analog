import { ProgressStatus } from './catalog-enums.js';
import {
    englishDataset,
    englishRecommendedTransformers,
    RegExpMatcher,
} from 'obscenity';
import { z } from 'zod';

export const REVIEW_MAX_LENGTH = 2000;
// Ratings count half stars, so 7 means 3.5 stars.
export const RATING_STARS = 5;
export const RATING_MAX = RATING_STARS * 2;

const profanityMatcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
});

export const SetProgressStatusSchema = z.object({
    status: z.enum(ProgressStatus).nullable(),
});

export const ReviewSchema = z.object({
    rating: z
        .number()
        .int()
        .min(1, `Rating must be 0.5 to ${RATING_STARS} stars`)
        .max(RATING_MAX, `Rating must be 0.5 to ${RATING_STARS} stars`)
        .nullable(),
    review: z
        .string()
        .trim()
        .max(
            REVIEW_MAX_LENGTH,
            `Review must be at most ${REVIEW_MAX_LENGTH} characters`
        )
        .refine(
            (value) => !profanityMatcher.hasMatch(value),
            'Review contains language that is not allowed'
        )
        .transform((value) => value || null)
        .nullable(),
    // With no date it counts as read but stays out of goals and charts. A day
    // of slack covers time zones ahead of the server.
    completedAt: z.iso
        .datetime()
        .refine(
            (value) => Date.parse(value) <= Date.now() + 24 * 60 * 60 * 1000,
            "Finish date can't be in the future"
        )
        .nullable(),
});
