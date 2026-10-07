import {
    CATALOG_TITLE_MAX_LENGTH,
    ItemTitleSchema,
    PersonRole,
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

// Empty means not known.
const WholeNumberField = z
    .unknown()
    .optional()
    .transform((value) =>
        value === '' || value == null ? null : Number(value)
    )
    .pipe(
        z
            .number({ error: 'Enter a number' })
            .int('Enter a whole number')
            .nonnegative("Can't be negative")
            .nullable()
    );

// Selects use NOT_SET for an empty value, and the API trims text.
export const EditionFormSchema = z.object({
    title: ItemTitleSchema,
    editionName: z.string(),
    format: z.string(),
    publisher: z.string(),
    releaseYear: WholeNumberField,
    releaseDate: z.string(),
    pageCount: WholeNumberField,
    language: z.string(),
    goodreadsId: z
        .string()
        .trim()
        .regex(/^\d*$/, 'Use the number from the Goodreads link'),
    credits: z.array(z.object({ name: z.string(), role: z.enum(PersonRole) })),
});

export const ItemDetailsFormSchema = z.object({
    kind: z.enum(SeriesKind).optional(),
    genres: z.array(z.string()),
    // Left out while hidden, for a volume in a series.
    audience: z.string().optional(),
    // Names in credit order.
    authors: z.array(z.string()),
    illustrators: z.array(z.string()),
    description: z.string(),
    firstPublishedYear: WholeNumberField,
});

export const SeriesItemsFormSchema = z.object({
    items: z.array(
        z.object({
            id: z.string(),
            title: ItemTitleSchema,
            volume: VolumeField,
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

export { UpdateNameSchema as NameFormSchema } from '@analog/types';
