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
