import {
    CATALOG_TITLE_MAX_LENGTH,
    SERIES_TITLE_MAX_LENGTH,
    SeriesKind,
    SeriesLanguageSchema,
} from '@analog/types';

import { SeriesPickSchema, VolumeField } from './catalog-schemas';
import { z } from 'zod';

const TitleField = z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(CATALOG_TITLE_MAX_LENGTH);

export const AdminItemFormSchema = z
    .object({
        title: TitleField,
        isSeries: z.boolean(),
        series: SeriesPickSchema.nullish(),
        volume: VolumeField,
    })
    .refine((values) => !values.isSeries || values.series != null, {
        message: 'Pick a series or type a new name',
        path: ['series'],
    });

// Select items can't be empty or null, so "Not set" has its own value.
export const NO_LANGUAGE = 'none';

export const AdminSeriesFormSchema = z.object({
    title: z
        .string()
        .trim()
        .min(1, 'Series name is required')
        .max(SERIES_TITLE_MAX_LENGTH),
    kind: z.enum(SeriesKind),
    language: z
        .string()
        .transform((value) => (value === NO_LANGUAGE ? null : value))
        .pipe(SeriesLanguageSchema.nullable()),
});

export const SeriesItemsFormSchema = z.object({
    items: z.array(
        z.object({
            id: z.string(),
            title: TitleField,
            volume: VolumeField,
            verified: z.boolean(),
        })
    ),
});

export const MergeSeriesFormSchema = z
    .object({ into: SeriesPickSchema.nullable() })
    .refine((values) => !!values.into?.id, {
        message: 'Pick a series that already exists',
        path: ['into'],
    });
