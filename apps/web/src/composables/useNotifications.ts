import { api, unwrap } from '@/lib/api';

import { COLLECTIONS_KEY } from './useCollections';
import { POLL_MS, usePaginatedList } from './usePaginatedList';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';

export const NOTIFICATIONS_KEY = ['notifications'] as const;

/** Incoming friend requests and collection invites, newest first. */
export function useNotifications() {
    return usePaginatedList(
        () => [...NOTIFICATIONS_KEY, 'list'],
        async (offset) =>
            unwrap(await api.notifications.$get({ query: { offset } })),
        { poll: true }
    );
}

/**
 * How many requests and invites are waiting, in total and by kind, for the
 * bell and the summary shown on first load. Checks every 30
 * seconds and when the tab regains focus.
 */
export function useNotificationCount() {
    return useQuery({
        queryKey: [...NOTIFICATIONS_KEY, 'count'],
        queryFn: async () => unwrap(await api.notifications.count.$get()),
        refetchInterval: POLL_MS,
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
