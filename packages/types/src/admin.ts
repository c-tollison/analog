import {
    SERIES_TITLE_MAX_LENGTH,
    SeriesChoiceSchema,
    SeriesLanguageSchema,
} from './catalog.js';
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

export const SetVerifiedSchema = z.object({ verified: z.boolean() });

const VolumeSchema = z.number().nonnegative().max(100_000).nullable();

export const UpdateCatalogItemSchema = z.object({
    title: z
        .string()
        .trim()
        .min(1, 'Title is required')
        .max(CATALOG_TITLE_MAX_LENGTH),
    series: SeriesChoiceSchema.nullable(),
    volume: VolumeSchema,
});

export const UpdateSeriesSchema = z.object({
    title: z
        .string()
        .trim()
        .min(1, 'Series name is required')
        .max(SERIES_TITLE_MAX_LENGTH),
    kind: z.enum(SeriesKind),
    language: SeriesLanguageSchema.nullable(),
});

export const MAX_SERIES_VOLUMES = 1000;

export const SetSeriesVolumesSchema = z.object({
    volumes: z
        .array(z.object({ id: z.uuid(), volume: VolumeSchema }))
        .min(1)
        .max(MAX_SERIES_VOLUMES),
});

export const MergeSeriesSchema = z.object({ intoSeriesId: z.uuid() });
