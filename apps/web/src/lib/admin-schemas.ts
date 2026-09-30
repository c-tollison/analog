import {
    CATALOG_TITLE_MAX_LENGTH,
    ItemTitleSchema,
    SeriesKind,
    SeriesTitleSchema,
} from '@analog/types';

import { SeriesPickSchema, VolumeField } from './catalog-schemas';
import { z } from 'zod';

// The form's starting values go through the schema too, so an empty
// subtitle comes back as null and has to be accepted.
const SubtitleField = z
    .string()
    .nullable()
    .transform((value) => value?.trim() || null)
    .pipe(z.string().max(CATALOG_TITLE_MAX_LENGTH).nullable());

// The series is saved as soon as it's picked, so it isn't a field here.
export const AdminItemFormSchema = z.object({
    title: ItemTitleSchema,
    subtitle: SubtitleField,
    volume: VolumeField,
});

export const AdminSeriesFormSchema = z.object({
    title: SeriesTitleSchema,
    kind: z.enum(SeriesKind),
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

// No series takes the item out of its series.
export const ChangeSeriesFormSchema = z.object({
    series: SeriesPickSchema.nullable(),
    volume: VolumeField,
});
