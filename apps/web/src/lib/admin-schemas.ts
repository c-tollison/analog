import {
    ItemTitleSchema,
    SeriesKind,
    SeriesLanguageSchema,
    SeriesTitleSchema,
} from '@analog/types';

import { SeriesPickSchema, VolumeField } from './catalog-schemas';
import { z } from 'zod';

export const AdminItemFormSchema = z
    .object({
        title: ItemTitleSchema,
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
    title: SeriesTitleSchema,
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
            title: ItemTitleSchema,
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
