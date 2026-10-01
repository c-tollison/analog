import type { RouteLocationNormalized } from 'vue-router';

const WAIT_MS = 2000;

let onPageEnter: (() => void) | null = null;

/** The page transitions call this once the new page is in the DOM. */
export function pageEntered() {
    onPageEnter?.();
    onPageEnter = null;
}

// The same routes keep the same components, so no transition runs.
function swapsPage(to: RouteLocationNormalized, from: RouteLocationNormalized) {
    return (
        to.matched.length !== from.matched.length ||
        to.matched.some((record, index) => record !== from.matched[index])
    );
}

/**
 * Resolves once the page is tall enough to scroll down to `top`. A page swaps
 * in after its transition and then fills in its data, so a spot further down
 * isn't there right away. Gives up after a couple of seconds.
 */
export function whenScrollable(
    top: number,
    to: RouteLocationNormalized,
    from: RouteLocationNormalized
): Promise<void> {
    const deadline = performance.now() + WAIT_MS;
    return new Promise((resolve) => {
        let started = false;
        const check = () => {
            const max =
                document.documentElement.scrollHeight - window.innerHeight;
            if (max >= top || performance.now() > deadline) {
                resolve();
            } else {
                requestAnimationFrame(check);
            }
        };
        const start = () => {
            if (started) return;
            started = true;
            check();
        };
        if (swapsPage(to, from)) {
            onPageEnter = start;
            setTimeout(start, WAIT_MS);
        } else {
            start();
        }
    });
}
