import {
    IsbnSchema,
    SERIES_TITLE_MAX_LENGTH,
    SetVolumeCountSchema,
} from '@analog/types';

import { z } from 'zod';

export {
    AddCatalogItemsSchema,
    CreateCollectionSchema,
    ReviewSchema,
} from '@analog/types';

export const IsbnLookupFormSchema = z.object({
    isbn: z.string().trim().min(1, 'Enter an ISBN').pipe(IsbnSchema),
});

export const SeriesPickSchema = z.object({
    id: z.string().nullable(),
    title: z
        .string()
        .trim()
        .min(1, 'Series name is required')
        .max(
            SERIES_TITLE_MAX_LENGTH,
            `Series name must be at most ${SERIES_TITLE_MAX_LENGTH} characters`
        ),
});

export const AddBookFormSchema = z
    .object({
        isSeries: z.boolean(),
        series: SeriesPickSchema.nullable(),
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

// Number inputs give strings; empty means no total.
const VolumeCountField = z
    .unknown()
    .transform((value) =>
        value === '' || value == null ? null : Number(value)
    )
    .pipe(SetVolumeCountSchema.shape.volumeCount);

export const VolumeCountFormSchema = z.object({
    volumeCount: VolumeCountField,
});

export const LinkDetailsSourceFormSchema = z
    .object({
        sourceId: z.string().nullable(),
        volumeCount: VolumeCountField,
    })
    .refine((values) => values.sourceId !== null, {
        message: 'Pick a match',
        path: ['sourceId'],
    });
