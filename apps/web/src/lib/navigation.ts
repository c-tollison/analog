import type { RouteLocationRaw, Router } from 'vue-router';

/**
 * Goes back to the previous page, which keeps its state, like a list's
 * filters. Opens `to` instead when there's nothing to go back to.
 */
export function goBackOr(router: Router, to: RouteLocationRaw) {
    if (window.history.state?.back) {
        router.back();
    } else {
        router.replace(to);
    }
}

// The path at each history position up to the current page, so a link can
// jump back to a page that's already behind the person instead of piling up
// history.
const visited: string[] = [];

export function trackVisits(router: Router) {
    router.afterEach((to, _from, failure) => {
        const position = window.history.state?.position;
        if (failure || typeof position !== 'number') return;
        visited.length = position + 1;
        visited[position] = to.path;
    });
}

/**
 * Goes back to `to` if it's already in history. Returns false when it isn't.
 */
export function goBackTo(router: Router, to: RouteLocationRaw): boolean {
    const position = window.history.state?.position;
    if (typeof position !== 'number' || position < 1) return false;
    const index = visited.lastIndexOf(router.resolve(to).path, position - 1);
    if (index === -1) return false;
    router.go(index - position);
    return true;
}
