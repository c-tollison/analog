import { IsbnSchema } from './isbn.js';
import { PageQuerySchema } from './pagination.js';
import { z } from 'zod';

export const SERIES_TITLE_MAX_LENGTH = 200;

export const SeriesSearchQuerySchema = PageQuerySchema.extend({
    q: z.string().trim().max(200).optional(),
});

export const GoogleSearchQuerySchema = z.object({
    q: z.string().trim().min(1).max(200),
});

// Google's ISBN search misses books its title search finds, so a book picked
// from those results is fetched by its Google id.
export const GoogleIdSchema = z.string().regex(/^[\w-]{1,40}$/);

export const IsbnLookupQuerySchema = z.object({
    googleId: GoogleIdSchema.optional(),
});

export const COLLECTION_NAME_MAX_LENGTH = 64;

export const SeriesTitleSchema = z
    .string()
    .trim()
    .min(1, 'Series name is required')
    .max(SERIES_TITLE_MAX_LENGTH);

export const SeriesChoiceSchema = z.union([
    z.object({ id: z.uuid() }),
    z.object({ title: SeriesTitleSchema }),
]);

export const AddBookSchema = z.object({
    isbn: IsbnSchema,
    series: SeriesChoiceSchema.nullable(),
    volume: z.number().nonnegative().nullable(),
});

export const OwnEditionSchema = z.object({ catalogItemId: z.uuid() });

export const CollectionNameSchema = z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(
        COLLECTION_NAME_MAX_LENGTH,
        `Name must be at most ${COLLECTION_NAME_MAX_LENGTH} characters`
    );

export const CreateCollectionSchema = z.object({ name: CollectionNameSchema });

export const UpdateCollectionSchema = z.object({ isPublic: z.boolean() });

export const MAX_VOLUME_COUNT = 1000;

const VolumeCountSchema = z
    .number()
    .int('Enter a whole number')
    .positive('Enter a number above 0')
    .max(MAX_VOLUME_COUNT)
    .nullable();

export const SetVolumeCountSchema = z.object({
    volumeCount: VolumeCountSchema,
});

/**
 * Which of a series' volumes to list: ones you own, ones you don't, or all.
 * With a shelf, owning means on that shelf.
 */
export const SERIES_VOLUME_FILTERS = ['owned', 'missing', 'all'] as const;

export type SeriesVolumeFilter = (typeof SERIES_VOLUME_FILTERS)[number];

/** A series page opened from one of your shelves counts only that shelf. */
export const SeriesPageQuerySchema = z.object({
    shelf: z.uuid('Invalid id').optional(),
});

export const SeriesVolumesQuerySchema = PageQuerySchema.extend({
    ...SeriesPageQuerySchema.shape,
    show: z.enum(SERIES_VOLUME_FILTERS).default('all'),
});

export const MAX_READING_GOAL = 10_000;

/** A yearly goal: how many items to finish. */
export const ReadingGoalSchema = z.object({
    target: z
        .number()
        .int('Enter a whole number')
        .positive('Enter a number above 0')
        .max(MAX_READING_GOAL),
});

/** A year for goals and stats, as a route param or query. */
export const GoalYearSchema = z.coerce.number().int().min(2000).max(2100);
