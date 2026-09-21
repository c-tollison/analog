import { API_URL } from './env';
import { emailOTPClient, twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/vue';
import { type ComputedRef, computed, shallowRef } from 'vue';

export const authClient = createAuthClient({
    baseURL: `${API_URL}/api/auth`,
    plugins: [emailOTPClient(), twoFactorClient()],
    fetchOptions: {
        credentials: 'include',
        onSuccess: (ctx) => {
            if (ctx.request.method !== 'GET') {
                clearCachedSession();
            }
        },
    },
});

export const { signIn, signUp, signOut, useSession, emailOtp, twoFactor } =
    authClient;

type Session = Awaited<ReturnType<typeof authClient.getSession>>['data'];

const cachedSession = shallowRef<Session | undefined>();
let pendingSession: Promise<Session> | undefined;

function isExpired(session: Session): boolean {
    return (
        session !== null &&
        new Date(session.session.expiresAt).getTime() <= Date.now()
    );
}

/**
 * Session for route guards. Fetched once and then served from memory, so
 * navigating doesn't hit the API on every route change.
 */
export async function getCachedSession(): Promise<Session> {
    const current = cachedSession.value;
    if (current !== undefined && !isExpired(current)) {
        return current;
    }

    pendingSession ??= authClient
        .getSession()
        .then(async ({ data, error }) => {
            if (error) {
                return data;
            }

            if (data && !data.user.emailVerified) {
                await authClient.signOut();
                cachedSession.value = null;
                return null;
            }

            cachedSession.value = data;
            return data;
        })
        .finally(() => {
            pendingSession = undefined;
        });

    return pendingSession;
}

export function clearCachedSession(): void {
    cachedSession.value = undefined;
    pendingSession = undefined;
}

/**
 * Cached Session values. Route guard ensures that cached session is valid prior
 * loading any page.
 *
 * Use `useSession()` instead if you need Better Auth's own polling and
 * cross-tab refresh.
 */
export function useAppSession(): ComputedRef<Session> {
    return computed(() => cachedSession.value ?? null);
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | undefined;

/** Registered once at startup so this module doesn't need to import the router. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
    unauthorizedHandler = handler;
}

/** Called when the API rejects a request because the session is gone. */
export function reportUnauthorized(): void {
    clearCachedSession();
    unauthorizedHandler?.();
}
