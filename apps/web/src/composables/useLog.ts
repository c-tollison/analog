import type { InferResponseType } from '@analog/api/client';
import type { LogRange, ReadingGoalSchema } from '@analog/types';
import { type ApiClient, api, unwrap } from '@/lib/api';

import {
    type PaginatedListOptions,
    usePaginatedList,
} from './usePaginatedList';
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import type { z } from 'zod';

export const LOG_KEY = ['log'] as const;

export type LogStats = InferResponseType<
    ApiClient['users'][':username']['log']['stats']['$get'],
    200
>;

/** Someone's Want to read list, grouped by series. */
export function useWantToRead(
    username: MaybeRefOrGetter<string>,
    options: PaginatedListOptions = {}
) {
    return usePaginatedList(
        () => [...LOG_KEY, toValue(username), 'planned'],
        async (offset) =>
            unwrap(
                await api.users[':username']['want-to-read'].$get({
                    param: { username: toValue(username) },
                    query: { offset },
                })
            ),
        options
    );
}

/** Each volume someone is reading, most recently changed first. */
export function useReading(
    username: MaybeRefOrGetter<string>,
    options: PaginatedListOptions = {}
) {
    return usePaginatedList(
        () => [...LOG_KEY, toValue(username), 'reading'],
        async (offset) =>
            unwrap(
                await api.users[':username'].reading.$get({
                    param: { username: toValue(username) },
                    query: { offset },
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

/** Someone's Log totals, finishes over `range` and this year's goal. */
export function useLogStats(
    username: MaybeRefOrGetter<string>,
    range: MaybeRefOrGetter<LogRange>
) {
    return useQuery({
        queryKey: () => [
            ...LOG_KEY,
            toValue(username),
            'stats',
            toValue(range),
        ],
        queryFn: async () =>
            unwrap(
                await api.users[':username'].log.stats.$get({
                    param: { username: toValue(username) },
                    // Days, months and years follow the viewer's clock.
                    query: {
                        range: toValue(range),
                        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    },
                })
            ),
        placeholderData: keepPreviousData,
    });
}

type GoalInput = z.output<typeof ReadingGoalSchema> & { year: number };

/** Sets your goal for a year, replacing any you had. */
export function useSetReadingGoal() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ year, ...json }: GoalInput) =>
            unwrap(
                await api.users.me.goals[':year'].$put({
                    param: { year: String(year) },
                    json,
                })
            ),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: LOG_KEY }),
    });
}

export function useRemoveReadingGoal() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (year: number) =>
            unwrap(
                await api.users.me.goals[':year'].$delete({
                    param: { year: String(year) },
                })
            ),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: LOG_KEY }),
    });
}
