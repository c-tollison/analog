import {
    Audience,
    CheckRule,
    CheckTrigger,
    CollectionRole,
    EditionFormat,
    ExternalSource,
    PersonRole,
    ProgressStatus,
    SeriesKind,
    UserRole,
} from '@analog/types';

import { appSchema } from './primitives.js';

// Values come from @analog/types so the API and web app share them. Passed as
// arrays: drizzle-kit drops the "app." schema prefix from column types when
// given an enum object.
function values<T extends string>(enumObject: Record<string, T>): [T, ...T[]] {
    const [first, ...rest] = Object.values(enumObject);
    if (first === undefined) {
        throw new Error('Enum has no values');
    }
    return [first, ...rest];
}

export const seriesKind = appSchema.enum('series_kind', values(SeriesKind));
export const collectionRole = appSchema.enum(
    'collection_role',
    values(CollectionRole)
);
export const externalSource = appSchema.enum(
    'external_source',
    values(ExternalSource)
);
export const progressStatus = appSchema.enum(
    'progress_status',
    values(ProgressStatus)
);
export const audience = appSchema.enum('audience', values(Audience));
export const editionFormat = appSchema.enum(
    'edition_format',
    values(EditionFormat)
);
export const personRole = appSchema.enum('person_role', values(PersonRole));
export const userRole = appSchema.enum('user_role', values(UserRole));
export const checkRule = appSchema.enum('check_rule', values(CheckRule));
export const checkTrigger = appSchema.enum(
    'check_trigger',
    values(CheckTrigger)
);
