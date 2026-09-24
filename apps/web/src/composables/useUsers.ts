import type { UpdateProfileSchema } from '@analog/types';
import { ApiError, api, unwrap } from '@/lib/api';
import { authClient } from '@/lib/auth';
import { useSessionStore } from '@/stores/session';

import {
    type PaginatedListOptions,
    usePaginatedList,
} from './usePaginatedList';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import type { z } from 'zod';

export const USERS_KEY = ['users'] as const;

/** People whose username starts with, or name contains, `q`. */
export function useUserSearch(
    q: MaybeRefOrGetter<string>,
    options: PaginatedListOptions = {}
) {
    return usePaginatedList(
        () => [...USERS_KEY, 'search', toValue(q)],
        async (offset) =>
            unwrap(await api.users.$get({ query: { q: toValue(q), offset } })),
        options
    );
}

/** One person by username, with how the signed-in user relates to them. */
export function useUser(username: MaybeRefOrGetter<string>) {
    return useQuery({
        queryKey: () => [...USERS_KEY, 'detail', toValue(username)],
        queryFn: async () =>
            unwrap(
                await api.users[':username'].$get({
                    param: { username: toValue(username) },
                })
            ),
    });
}

/**
 * Saves the signed-in user's name and username. Any auth change clears the
 * session and query cache, so this reloads the session before resolving.
 */
export function useUpdateProfile() {
    const sessionStore = useSessionStore();

    return useMutation({
        mutationFn: async (values: z.output<typeof UpdateProfileSchema>) => {
            const { error } = await authClient.updateUser(values);
            if (error) {
                throw new ApiError(
                    error.message ?? 'Unable to save your profile.',
                    error.status
                );
            }
            await sessionStore.load();
        },
    });
}

/** Uploads a new profile photo for the signed-in user. */
export function useUploadAvatar() {
    const queryClient = useQueryClient();
    const sessionStore = useSessionStore();

    return useMutation({
        mutationFn: async (file: File) =>
            unwrap(await api.users.me.avatar.$put({ form: { file } })),
        onSuccess: async () => {
            await sessionStore.refresh();
            await queryClient.invalidateQueries({ queryKey: USERS_KEY });
        },
    });
}

/** Removes the signed-in user's profile photo. */
export function useRemoveAvatar() {
    const queryClient = useQueryClient();
    const sessionStore = useSessionStore();

    return useMutation({
        mutationFn: async () => unwrap(await api.users.me.avatar.$delete()),
        onSuccess: async () => {
            await sessionStore.refresh();
            await queryClient.invalidateQueries({ queryKey: USERS_KEY });
        },
    });
}
