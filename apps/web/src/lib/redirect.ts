import type { LocationQuery } from 'vue-router';

/** The in-app path to return to after auth, carried in `?redirect=`. */
export function getRedirect(query: LocationQuery): string {
    const redirect = query.redirect;
    // Only same-origin paths, so the query can't send users off-site.
    return typeof redirect === 'string' &&
        redirect.startsWith('/') &&
        !redirect.startsWith('//')
        ? redirect
        : '/';
}
