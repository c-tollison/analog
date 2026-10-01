export enum SeriesKind {
    Manga = 'manga',
    LightNovel = 'light_novel',
    Book = 'book',
    Tv = 'tv',
    Film = 'film',
}

export enum MediaFormat {
    Book = 'book',
    Dvd = 'dvd',
    Bluray = 'bluray',
    Uhd4k = 'uhd_4k',
}

export enum CollectionRole {
    Owner = 'owner',
    Editor = 'editor',
}

export enum ExternalSource {
    OpenLibrary = 'openlibrary',
    GoogleBooks = 'googlebooks',
    AniList = 'anilist',
}

export enum ProgressStatus {
    Planned = 'planned',
    InProgress = 'in_progress',
    Completed = 'completed',
}

/** How far back the Log's stats look. */
export enum LogRange {
    ThirtyDays = '30_days',
    TwelveMonths = '12_months',
    AllTime = 'all_time',
}

export enum CollectionSort {
    Name = 'name',
    Newest = 'newest',
}

// Problems `pnpm catalog:check` finds. The rules are listed in
// apps/api/src/lib/catalog-check.ts.
export enum CheckRule {
    TitleStyle = 'title_style',
    ExtraWords = 'extra_words',
    MissingVolume = 'missing_volume',
    VolumeMismatch = 'volume_mismatch',
    DuplicateVolume = 'duplicate_volume',
    WrongSeries = 'wrong_series',
    SeriesSpelling = 'series_spelling',
    DuplicateSeries = 'duplicate_series',
}

// What started a `pnpm catalog:check` run on a book or series.
export enum CheckTrigger {
    Scan = 'scan',
    Admin = 'admin',
    Refresh = 'refresh',
    Sweep = 'sweep',
}
