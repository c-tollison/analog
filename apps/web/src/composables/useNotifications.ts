import { api, unwrap } from '@/lib/api';

import { COLLECTIONS_KEY } from './useCollections';
import { usePaginatedList } from './usePaginatedList';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { watch } from 'vue';

export const NOTIFICATIONS_KEY = ['notifications'] as const;

const COUNT_REFRESH_MS = 30_000;

/** Incoming friend requests and collection invites, newest first. */
export function useNotifications() {
    return usePaginatedList(
        () => [...NOTIFICATIONS_KEY, 'list'],
        async (offset) =>
            unwrap(await api.notifications.$get({ query: { offset } }))
    );
}

/**
 * How many requests and invites are waiting, for the bell. Checks every 30
 * seconds and when the tab regains focus. When the count changes, the
 * notification and friend request lists reload too.
 */
export function useNotificationCount() {
    const queryClient = useQueryClient();
    const query = useQuery({
        queryKey: [...NOTIFICATIONS_KEY, 'count'],
        queryFn: async () => unwrap(await api.notifications.count.$get()),
        refetchInterval: COUNT_REFRESH_MS,
        refetchOnWindowFocus: true,
    });

    watch(
        () => query.data.value?.count,
        (_count, previous) => {
            if (previous === undefined) return;
            void queryClient.invalidateQueries({
                queryKey: NOTIFICATIONS_KEY,
                predicate: (q) => q.queryKey[1] !== 'count',
            });
        }
    );

    return query;
}

export function useAcceptInvite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (param: { collectionId: string }) =>
            unwrap(await api.invites[':collectionId'].accept.$post({ param })),
        onSuccess: () =>
            Promise.all(
                [NOTIFICATIONS_KEY, COLLECTIONS_KEY].map((queryKey) =>
                    queryClient.invalidateQueries({ queryKey })
                )
            ),
    });
}

export function useDeclineInvite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (param: { collectionId: string }) =>
            unwrap(await api.invites[':collectionId'].$delete({ param })),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
    });
}
