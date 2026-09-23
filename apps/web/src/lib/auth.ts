import { useSessionStore } from '@/stores/session';

import { API_URL } from './env';
import { emailOTPClient, twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/vue';

export const authClient = createAuthClient({
    baseURL: `${API_URL}/api/auth`,
    plugins: [emailOTPClient(), twoFactorClient()],
    fetchOptions: {
        credentials: 'include',
        onSuccess: (ctx) => {
            if (ctx.request.method !== 'GET') {
                useSessionStore().clear();
            }
        },
    },
});

export const { signIn, signUp, signOut, useSession, emailOtp, twoFactor } =
    authClient;

export type Session = Awaited<ReturnType<typeof authClient.getSession>>['data'];

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | undefined;

/** Registered once at startup so this module doesn't need to import the router. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
    unauthorizedHandler = handler;
}

/** Called when the API rejects a request because the session is gone. */
export function reportUnauthorized(): void {
    useSessionStore().clear();
    unauthorizedHandler?.();
}
