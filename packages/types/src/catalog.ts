import { ExternalSource, SeriesKind } from './catalog-enums.js';
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

/** Which of a series' volumes to list: ones you own, ones you don't, or all. */
export const SERIES_VOLUME_FILTERS = ['owned', 'missing', 'all'] as const;

export type SeriesVolumeFilter = (typeof SERIES_VOLUME_FILTERS)[number];

export const SeriesVolumesQuerySchema = PageQuerySchema.extend({
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

/** Sources a series can pull its synopsis, genres and run from. */
export const DETAILS_SOURCES = [ExternalSource.AniList] as const;

export type DetailsSource = (typeof DETAILS_SOURCES)[number];

export const DetailsSourceSchema = z.enum(DETAILS_SOURCES);

/** Each source's display name and the kinds of series it covers. */
export const DETAILS_SOURCE_INFO: Record<
    DetailsSource,
    { label: string; kinds: readonly SeriesKind[] }
> = {
    [ExternalSource.AniList]: {
        label: 'AniList',
        kinds: [SeriesKind.Manga, SeriesKind.LightNovel],
    },
};

/** Where a series of this kind can get more details, if anywhere. */
export function detailsSourceFor(kind: SeriesKind): DetailsSource | null {
    return (
        DETAILS_SOURCES.find((source) =>
            DETAILS_SOURCE_INFO[source].kinds.includes(kind)
        ) ?? null
    );
}

export const LinkDetailsSourceSchema = SetVolumeCountSchema.extend({
    source: DetailsSourceSchema,
    sourceId: z.string().trim().min(1).max(100),
});
