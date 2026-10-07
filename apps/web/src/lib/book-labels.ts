import { ProgressStatus, SeriesKind } from '@analog/types';

import type { BarcodeFormat } from 'vue-qrcode-reader';

/** A book's barcode is its ISBN-13 as an EAN-13. */
export const BOOK_BARCODES: BarcodeFormat[] = ['ean_13'];

export const SERIES_KIND_LABELS: Record<SeriesKind, string> = {
    [SeriesKind.Manga]: 'Manga',
    [SeriesKind.LightNovel]: 'Light novel',
    [SeriesKind.Book]: 'Book',
    [SeriesKind.GraphicNovel]: 'Graphic novel',
    [SeriesKind.ShortStories]: 'Short stories',
};

export const STATUS_LABELS: Record<ProgressStatus, string> = {
    [ProgressStatus.Planned]: 'Want to read',
    [ProgressStatus.InProgress]: 'Reading',
    [ProgressStatus.Completed]: 'Read',
};

export const PROGRESS_STATUSES = [
    ProgressStatus.Planned,
    ProgressStatus.InProgress,
    ProgressStatus.Completed,
] as const;
