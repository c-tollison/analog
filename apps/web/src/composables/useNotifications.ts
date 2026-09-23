import { api, unwrap } from '@/lib/api';

import { COLLECTIONS_KEY } from './useCollections';
import { usePaginatedList } from './usePaginatedList';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';

export const NOTIFICATIONS_KEY = ['notifications'] as const;

const COUNT_REFRESH_MS = 5 * 60_000;

/** Incoming friend requests and collection invites, newest first. */
export function useNotifications() {
    return usePaginatedList(
        () => [...NOTIFICATIONS_KEY, 'list'],
        async (offset) =>
            unwrap(await api.notifications.$get({ query: { offset } }))
    );
}

/**
 * How many requests and invites are waiting, for the bell. Refreshes when
 * the tab regains focus, and every few minutes as a fallback.
 */
export function useNotificationCount() {
    return useQuery({
        queryKey: [...NOTIFICATIONS_KEY, 'count'],
        queryFn: async () => unwrap(await api.notifications.count.$get()),
        refetchInterval: COUNT_REFRESH_MS,
        refetchOnWindowFocus: true,
    });
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
