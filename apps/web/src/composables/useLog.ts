import type { InferResponseType } from '@analog/api/client';
import type { ProgressStatus, ReadingGoalSchema } from '@analog/types';
import { type ApiClient, api, unwrap } from '@/lib/api';

import {
    type PaginatedListOptions,
    usePaginatedList,
} from './usePaginatedList';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import type { z } from 'zod';

export const LOG_KEY = ['log'] as const;

type GroupedStatus = ProgressStatus.Planned | ProgressStatus.InProgress;

export type LogStats = InferResponseType<
    ApiClient['users'][':username']['log']['stats']['$get'],
    200
>;

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

/** Someone's Log totals, finishes by month and goal for `year`. */
export function useLogStats(
    username: MaybeRefOrGetter<string>,
    year: MaybeRefOrGetter<number>
) {
    return useQuery({
        queryKey: () => [...LOG_KEY, toValue(username), 'stats', toValue(year)],
        queryFn: async () =>
            unwrap(
                await api.users[':username'].log.stats.$get({
                    param: { username: toValue(username) },
                    query: { year: String(toValue(year)) },
                })
            ),
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
