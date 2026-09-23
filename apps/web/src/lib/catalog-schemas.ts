import { IsbnSchema, SERIES_TITLE_MAX_LENGTH } from '@analog/types';

import { z } from 'zod';

export { AddCatalogItemsSchema, CreateCollectionSchema } from '@analog/types';

export const IsbnLookupFormSchema = z.object({
    isbn: z.string().trim().min(1, 'Enter an ISBN').pipe(IsbnSchema),
});

export const AddBookFormSchema = z
    .object({
        isSeries: z.boolean(),
        series: z
            .object({
                id: z.string().nullable(),
                title: z
                    .string()
                    .trim()
                    .min(1, 'Series name is required')
                    .max(
                        SERIES_TITLE_MAX_LENGTH,
                        `Series name must be at most ${SERIES_TITLE_MAX_LENGTH} characters`
                    ),
            })
            .nullable(),
        volume: z
            .unknown()
            .transform((value) =>
                value === '' || value == null ? null : Number(value)
            )
            .pipe(
                z
                    .number({ error: 'Enter a number' })
                    .nonnegative('Volume can’t be negative')
                    .nullable()
            ),
    })
    .refine((values) => !values.isSeries || values.series !== null, {
        message: 'Pick a series or type a new name',
        path: ['series'],
    });
