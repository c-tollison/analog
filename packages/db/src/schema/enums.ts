import {
    CollectionRole,
    ExternalSource,
    MediaFormat,
    SeriesKind,
} from '@analog/types';

import { appSchema } from './primitives.js';

// Values come from @analog/types so the API and web app share them. Passed as
// arrays: drizzle-kit drops the "app." schema prefix from column types when
// given an enum object.
function values<T extends string>(enumObject: Record<string, T>): [T, ...T[]] {
    return Object.values(enumObject) as [T, ...T[]];
}

export const seriesKind = appSchema.enum('series_kind', values(SeriesKind));
export const mediaFormat = appSchema.enum('media_format', values(MediaFormat));
export const collectionRole = appSchema.enum(
    'collection_role',
    values(CollectionRole)
);
export const externalSource = appSchema.enum(
    'external_source',
    values(ExternalSource)
);
