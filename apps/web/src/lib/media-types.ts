import {
    type DetailsSource,
    ExternalSource,
    MediaFormat,
    ProgressStatus,
    SeriesKind,
} from '@analog/types';

import type { BarcodeFormat } from 'vue-qrcode-reader';

export interface MediaType {
    value: string;
    label: string;
    formats: BarcodeFormat[];
}

// Each media type gets its own lookup source. Movies/TV, music, vinyl and
// games will be added here once we pick their data sources.
export const MEDIA_TYPES = [
    {
        value: MediaFormat.Book,
        label: 'Books & manga',
        formats: ['ean_13'],
    },
] as const satisfies readonly MediaType[];

export type MediaTypeValue = (typeof MEDIA_TYPES)[number]['value'];

export const SERIES_KIND_LABELS: Record<SeriesKind, string> = {
    [SeriesKind.Manga]: 'Manga',
    [SeriesKind.LightNovel]: 'Light novel',
    [SeriesKind.Book]: 'Book',
    [SeriesKind.Tv]: 'TV',
    [SeriesKind.Film]: 'Film',
};

export const FORMAT_LABELS: Record<MediaFormat, string> = {
    [MediaFormat.Book]: 'Book',
    [MediaFormat.Dvd]: 'DVD',
    [MediaFormat.Bluray]: 'Blu-ray',
    [MediaFormat.Uhd4k]: '4K UHD',
};

type MediaVerb = 'read' | 'watch' | 'listen';

/** How someone gets through each format, for status wording. */
const FORMAT_VERBS: Record<MediaFormat, MediaVerb> = {
    [MediaFormat.Book]: 'read',
    [MediaFormat.Dvd]: 'watch',
    [MediaFormat.Bluray]: 'watch',
    [MediaFormat.Uhd4k]: 'watch',
};

const KIND_VERBS: Record<SeriesKind, MediaVerb> = {
    [SeriesKind.Manga]: 'read',
    [SeriesKind.LightNovel]: 'read',
    [SeriesKind.Book]: 'read',
    [SeriesKind.Tv]: 'watch',
    [SeriesKind.Film]: 'watch',
};

export type StatusLabels = Record<ProgressStatus, string>;

const STATUS_LABELS: Record<MediaVerb | 'mixed', StatusLabels> = {
    read: {
        [ProgressStatus.Planned]: 'Want to read',
        [ProgressStatus.InProgress]: 'Reading',
        [ProgressStatus.Completed]: 'Read',
    },
    watch: {
        [ProgressStatus.Planned]: 'Want to watch',
        [ProgressStatus.InProgress]: 'Watching',
        [ProgressStatus.Completed]: 'Watched',
    },
    listen: {
        [ProgressStatus.Planned]: 'Want to listen',
        [ProgressStatus.InProgress]: 'Listening',
        [ProgressStatus.Completed]: 'Listened',
    },
    mixed: {
        [ProgressStatus.Planned]: 'Planned',
        [ProgressStatus.InProgress]: 'In progress',
        [ProgressStatus.Completed]: 'Complete',
    },
};

export const PROGRESS_STATUSES = [
    ProgressStatus.Planned,
    ProgressStatus.InProgress,
    ProgressStatus.Completed,
] as const;

export function formatStatusLabels(format: MediaFormat): StatusLabels {
    return STATUS_LABELS[FORMAT_VERBS[format]];
}

export function kindStatusLabels(kind: SeriesKind): StatusLabels {
    return STATUS_LABELS[KIND_VERBS[kind]];
}

/** Labels for a mix of formats: specific when they share a verb. */
export function formatsStatusLabels(formats: MediaFormat[]): StatusLabels {
    const verbs = new Set(formats.map((format) => FORMAT_VERBS[format]));
    const [only] = verbs;
    return verbs.size === 1 && only ? STATUS_LABELS[only] : STATUS_LABELS.mixed;
}

/** "read", "watched": the completed label as it reads mid-sentence. */
export function completedWord(labels: StatusLabels): string {
    return labels[ProgressStatus.Completed].toLowerCase();
}

export const DETAILS_SOURCE_LABELS: Record<DetailsSource, string> = {
    [ExternalSource.AniList]: 'AniList',
};

/** Where a series of this kind can get its synopsis and run, if anywhere. */
const KIND_DETAILS_SOURCES: Record<SeriesKind, DetailsSource | null> = {
    [SeriesKind.Manga]: ExternalSource.AniList,
    [SeriesKind.LightNovel]: ExternalSource.AniList,
    [SeriesKind.Book]: null,
    [SeriesKind.Tv]: null,
    [SeriesKind.Film]: null,
};

export function detailsSourceFor(kind: SeriesKind): DetailsSource | null {
    return KIND_DETAILS_SOURCES[kind];
}
