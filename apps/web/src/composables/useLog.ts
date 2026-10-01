import type { ProgressStatus } from '@analog/types';
import { api, unwrap } from '@/lib/api';

import {
    type PaginatedListOptions,
    usePaginatedList,
} from './usePaginatedList';
import { type MaybeRefOrGetter, toValue } from 'vue';

export const LOG_KEY = ['log'] as const;

type GroupedStatus = ProgressStatus.Planned | ProgressStatus.InProgress;

/** Someone's Want to read or Reading list, grouped by series. */
export function useLogGroups(
    username: MaybeRefOrGetter<string>,
    status: MaybeRefOrGetter<GroupedStatus>,
    options: PaginatedListOptions = {}
) {
    return usePaginatedList(
        () => [...LOG_KEY, toValue(username), toValue(status)],
        async (offset) =>
            unwrap(
                await api.users[':username'].log.$get({
                    param: { username: toValue(username) },
                    query: { status: toValue(status), offset },
                })
            ),
        options
    );
}

/** Everything someone has read, newest finished first. */
export function useDiary(
    username: MaybeRefOrGetter<string>,
    options: PaginatedListOptions = {}
) {
    return usePaginatedList(
        () => [...LOG_KEY, toValue(username), 'diary'],
        async (offset) =>
            unwrap(
                await api.users[':username'].diary.$get({
                    param: { username: toValue(username) },
                    query: { offset },
                })
            ),
        options
    );
}
