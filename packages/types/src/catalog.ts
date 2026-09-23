import { ExternalSource, SeriesKind } from './catalog-enums.js';
import { IsbnSchema } from './isbn.js';
import { z } from 'zod';

export const SERIES_TITLE_MAX_LENGTH = 200;
export const COLLECTION_NAME_MAX_LENGTH = 64;

export const SeriesChoiceSchema = z.union([
    z.object({ id: z.uuid() }),
    z.object({
        title: z
            .string()
            .trim()
            .min(1, 'Series name is required')
            .max(SERIES_TITLE_MAX_LENGTH),
    }),
]);

export const AddBookSchema = z.object({
    isbn: IsbnSchema,
    series: SeriesChoiceSchema.nullable(),
    volume: z.number().nonnegative().nullable(),
});

export const CollectionNameSchema = z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(
        COLLECTION_NAME_MAX_LENGTH,
        `Name must be at most ${COLLECTION_NAME_MAX_LENGTH} characters`
    );

export const CreateCollectionSchema = z.object({ name: CollectionNameSchema });

export const MAX_BULK_ADD = 100;

export const AddCatalogItemsSchema = z.object({
    catalogItemIds: z
        .array(z.uuid())
        .min(1, 'Pick at least one item')
        .max(MAX_BULK_ADD, `Add at most ${MAX_BULK_ADD} items at a time`),
});

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
