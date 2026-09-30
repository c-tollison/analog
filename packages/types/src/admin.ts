import {
    GoogleSearchQuerySchema,
    SeriesChoiceSchema,
    SeriesTitleSchema,
} from './catalog.js';
import { CheckRule, SeriesKind } from './catalog-enums.js';
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

// A book's subtitle, like a volume's own name. Empty clears it.
export const ItemSubtitleSchema = z
    .string()
    .trim()
    .max(CATALOG_TITLE_MAX_LENGTH)
    .transform((value) => value || null);

export const UpdateCatalogItemSchema = z.object({
    title: ItemTitleSchema,
    // Left out, it stays as it is.
    subtitle: ItemSubtitleSchema.nullable().optional(),
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

export const AdminGoogleSearchQuerySchema = GoogleSearchQuerySchema.extend({
    // An ISO 639-1 code, like "en".
    lang: z
        .string()
        .regex(/^[a-z]{2}$/)
        .optional(),
    offset: z.coerce.number().int().min(0).max(1000).default(0),
});

// How each `pnpm catalog:check` rule shows on the admin pages. "code"
// rules are exact checks; "jev" rules are judged by TypeSafe's Jev model.
export const CHECK_RULES: Record<
    CheckRule,
    { label: string; description: string; judge: 'code' | 'jev' }
> = {
    [CheckRule.TitleStyle]: {
        label: 'Title style',
        description:
            'Manga and light novel titles are "Series, Vol. N", with no volume subtitle. Punctuation differences are ignored.',
        judge: 'code',
    },
    [CheckRule.ExtraWords]: {
        label: 'Extra words',
        description: 'Names have no tags like "(English)" or "(Manga)".',
        judge: 'jev',
    },
    [CheckRule.MissingVolume]: {
        label: 'Missing volume',
        description: 'Manga and light novels in a series have a volume number.',
        judge: 'code',
    },
    [CheckRule.VolumeMismatch]: {
        label: 'Wrong volume',
        description: 'The number in the title matches the saved volume.',
        judge: 'jev',
    },
    [CheckRule.DuplicateVolume]: {
        label: 'Same volume',
        description: 'No two books in a series share a volume number.',
        judge: 'code',
    },
    [CheckRule.WrongSeries]: {
        label: 'Wrong series',
        description:
            "Art books and guidebooks aren't in a series of volumes, and a book whose title names an edition (Omnibus, VIZBIG...) is in a series with that edition in its name.",
        judge: 'jev',
    },
    [CheckRule.SeriesSpelling]: {
        label: 'Series name',
        description:
            "The series name is spelled right, going by its books' titles.",
        judge: 'jev',
    },
    [CheckRule.DuplicateSeries]: {
        label: 'Same series',
        description:
            'No two series of the same edition have the same name written differently.',
        judge: 'jev',
    },
};

// Rules whose fix is exact enough to accept in one click.
export const ACCEPTABLE_RULES: readonly CheckRule[] = [
    CheckRule.TitleStyle,
    CheckRule.VolumeMismatch,
    CheckRule.WrongSeries,
    CheckRule.SeriesSpelling,
];

export const CheckRunListQuerySchema = PageQuerySchema.extend({
    sort: z.enum(AddedSort).default(AddedSort.Newest),
});
