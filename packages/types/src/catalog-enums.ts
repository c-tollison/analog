export enum SeriesKind {
    Manga = 'manga',
    LightNovel = 'light_novel',
    Book = 'book',
    GraphicNovel = 'graphic_novel',
    ShortStories = 'short_stories',
}

// Who a book is written for. Genres are what it's about. Manga use their
// own demographics, and kodomo is Children.
export enum Audience {
    Children = 'children',
    YoungAdult = 'young_adult',
    NewAdult = 'new_adult',
    Adult = 'adult',
    Shonen = 'shonen',
    Shoujo = 'shoujo',
    Seinen = 'seinen',
    Josei = 'josei',
}

export const AUDIENCE_LABELS: Record<Audience, string> = {
    [Audience.Children]: 'Children',
    [Audience.YoungAdult]: 'Young adult',
    [Audience.NewAdult]: 'New adult',
    [Audience.Adult]: 'Adult',
    [Audience.Shonen]: 'Shonen',
    [Audience.Shoujo]: 'Shoujo',
    [Audience.Seinen]: 'Seinen',
    [Audience.Josei]: 'Josei',
};

/** Audiences in groups, for pickers. */
export const AUDIENCE_GROUPS = [
    {
        label: 'General',
        audiences: [
            Audience.Children,
            Audience.YoungAdult,
            Audience.NewAdult,
            Audience.Adult,
        ],
    },
    {
        label: 'Manga',
        audiences: [
            Audience.Shonen,
            Audience.Shoujo,
            Audience.Seinen,
            Audience.Josei,
        ],
    },
] as const;

// How one ISBN is made. Special editions are still one of these.
export enum EditionFormat {
    Paperback = 'paperback',
    Hardcover = 'hardcover',
    Ebook = 'ebook',
    Audiobook = 'audiobook',
}

export const EDITION_FORMAT_LABELS: Record<EditionFormat, string> = {
    [EditionFormat.Paperback]: 'Paperback',
    [EditionFormat.Hardcover]: 'Hardcover',
    [EditionFormat.Ebook]: 'Ebook',
    [EditionFormat.Audiobook]: 'Audiobook',
};

export enum PersonRole {
    Author = 'author',
    Illustrator = 'illustrator',
    Translator = 'translator',
    Editor = 'editor',
    Narrator = 'narrator',
    Foreword = 'foreword',
    Afterword = 'afterword',
    CoverArtist = 'cover_artist',
}

export const PERSON_ROLE_LABELS: Record<PersonRole, string> = {
    [PersonRole.Author]: 'Author',
    [PersonRole.Illustrator]: 'Illustrator',
    [PersonRole.Translator]: 'Translator',
    [PersonRole.Editor]: 'Editor',
    [PersonRole.Narrator]: 'Narrator',
    [PersonRole.Foreword]: 'Foreword',
    [PersonRole.Afterword]: 'Afterword',
    [PersonRole.CoverArtist]: 'Cover artist',
};

// Who made the work, credited once on the item.
export const ITEM_ROLES = [PersonRole.Author, PersonRole.Illustrator] as const;

// Who worked on one edition, like a translation's translator.
export const EDITION_ROLES = [
    PersonRole.Translator,
    PersonRole.Editor,
    PersonRole.Narrator,
    PersonRole.Foreword,
    PersonRole.Afterword,
    PersonRole.CoverArtist,
] as const;

export enum CollectionRole {
    Owner = 'owner',
    Editor = 'editor',
}

export enum ExternalSource {
    OpenLibrary = 'openlibrary',
    GoogleBooks = 'googlebooks',
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
