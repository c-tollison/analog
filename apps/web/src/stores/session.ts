import { authClient, type Session } from '@/lib/auth';
import { queryClient } from '@/lib/query';

import { defineStore } from 'pinia';
import { computed, shallowRef } from 'vue';

function isExpired(session: Session): boolean {
    return (
        session !== null &&
        new Date(session.session.expiresAt).getTime() <= Date.now()
    );
}

/**
 * The signed-in session. Fetched once and then served from memory, so route
 * guards don't hit the API on every navigation. Use Better Auth's
 * `useSession()` instead if you need its polling and cross-tab refresh.
 */
export const useSessionStore = defineStore('session', () => {
    const cached = shallowRef<Session | undefined>();
    let pending: Promise<Session> | undefined;

    const session = computed(() => cached.value ?? null);

    async function load(): Promise<Session> {
        const current = cached.value;
        if (current !== undefined && !isExpired(current)) {
            return current;
        }

        pending ??= authClient
            .getSession()
            .then(async ({ data, error }) => {
                if (error) {
                    return data;
                }

                if (data && !data.user.emailVerified) {
                    await authClient.signOut();
                    cached.value = null;
                    return null;
                }

                cached.value = data;
                return data;
            })
            .finally(() => {
                pending = undefined;
            });

        return pending;
    }

    /**
     * Refetches the session past Better Auth's cookie cache. Call it after
     * the API changes the user outside Better Auth.
     */
    async function refresh(): Promise<void> {
        const { data } = await authClient.getSession({
            query: { disableCookieCache: true },
        });
        if (data) {
            cached.value = data;
        }
    }

    function clear(): void {
        cached.value = undefined;
        pending = undefined;
        queryClient.clear();
    }

    return { session, load, refresh, clear };
});
