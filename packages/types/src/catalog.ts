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
