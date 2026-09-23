import type { UserIdSchema } from '@analog/types';
import { api, unwrap } from '@/lib/api';

import { COLLECTIONS_KEY } from './useCollections';
import { NOTIFICATIONS_KEY } from './useNotifications';
import {
    type PaginatedListOptions,
    usePaginatedList,
} from './usePaginatedList';
import { USERS_KEY } from './useUsers';
import {
    type QueryClient,
    useMutation,
    useQueryClient,
} from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import type { z } from 'zod';

export const FRIENDS_KEY = ['friends'] as const;

type UserId = z.output<typeof UserIdSchema>;

// A friendship change shows up in friend lists, user pages, notifications
// and who can be invited to a collection.
function invalidateSocial(queryClient: QueryClient) {
    return Promise.all(
        [FRIENDS_KEY, USERS_KEY, NOTIFICATIONS_KEY, COLLECTIONS_KEY].map(
            (queryKey) => queryClient.invalidateQueries({ queryKey })
        )
    );
}

/** The signed-in user's friends, optionally filtered by `q`. */
export function useFriends(
    q: MaybeRefOrGetter<string>,
    options: PaginatedListOptions = {}
) {
    return usePaginatedList(
        () => [...FRIENDS_KEY, 'list', toValue(q)],
        async (offset) =>
            unwrap(
                await api.friends.$get({
                    query: { offset, ...(toValue(q) ? { q: toValue(q) } : {}) },
                })
            ),
        options
    );
}

/** Send a request, or accept theirs if they already sent one. */
export function useSendFriendRequest() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (json: UserId) =>
            unwrap(await api.friends.requests.$post({ json })),
        onSuccess: () => invalidateSocial(queryClient),
    });
}

export function useCancelFriendRequest() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (param: UserId) =>
            unwrap(
                await api.friends.requests.sent[':userId'].$delete({ param })
            ),
        onSuccess: () => invalidateSocial(queryClient),
    });
}

export function useAcceptFriendRequest() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (param: UserId) =>
            unwrap(
                await api.friends.requests.received[':userId'].accept.$post({
                    param,
                })
            ),
        onSuccess: () => invalidateSocial(queryClient),
    });
}

export function useDeclineFriendRequest() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (param: UserId) =>
            unwrap(
                await api.friends.requests.received[':userId'].$delete({
                    param,
                })
            ),
        onSuccess: () => invalidateSocial(queryClient),
    });
}

export function useRemoveFriend() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (param: UserId) =>
            unwrap(await api.friends[':userId'].$delete({ param })),
        onSuccess: () => invalidateSocial(queryClient),
    });
}
