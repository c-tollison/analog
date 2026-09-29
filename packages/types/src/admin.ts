import { SeriesChoiceSchema, SeriesTitleSchema } from './catalog.js';
import { SeriesKind } from './catalog-enums.js';
import { PageQuerySchema } from './pagination.js';
import { z } from 'zod';

export const CATALOG_TITLE_MAX_LENGTH = 500;

export enum VerifiedFilter {
    Unverified = 'unverified',
    Verified = 'verified',
    All = 'all',
}

export enum AddedSort {
    Newest = 'newest',
    Oldest = 'oldest',
}

export const AdminListQuerySchema = PageQuerySchema.extend({
    q: z.string().trim().max(200).optional(),
    status: z.enum(VerifiedFilter).default(VerifiedFilter.Unverified),
    sort: z.enum(AddedSort).default(AddedSort.Newest),
});

export const AdminItemListQuerySchema = AdminListQuerySchema.extend({
    // Only items with no cover.
    noCover: z.stringbool().default(false),
});

export const SetVerifiedSchema = z.object({ verified: z.boolean() });

const VolumeSchema = z.number().nonnegative().max(100_000).nullable();

export const ItemTitleSchema = z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(CATALOG_TITLE_MAX_LENGTH);

export const UpdateCatalogItemSchema = z.object({
    title: ItemTitleSchema,
    series: SeriesChoiceSchema.nullable(),
    volume: VolumeSchema,
});

export const MergeItemSchema = z.object({ intoItemId: z.uuid() });

export const UpdateSeriesSchema = z.object({
    title: SeriesTitleSchema,
    kind: z.enum(SeriesKind),
});

export const MAX_SERIES_VOLUMES = 1000;

/** Edits to a series' items from its admin page, changed rows only. */
export const SetSeriesItemsSchema = z.object({
    items: z
        .array(
            z.object({
                id: z.uuid(),
                title: ItemTitleSchema,
                volume: VolumeSchema,
                verified: z.boolean(),
            })
        )
        .min(1)
        .max(MAX_SERIES_VOLUMES),
});

export const MergeSeriesSchema = z.object({ intoSeriesId: z.uuid() });
