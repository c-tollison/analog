import { MediaFormat, SeriesKind } from '@analog/types';

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
