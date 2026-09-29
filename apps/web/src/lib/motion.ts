import { DEFAULT_PAGE_SIZE } from '@analog/types';

const STEP_MS = 35;
const MAX_STEPS = 12;

/**
 * Fades a list row up into place a little after the one before it. Spread it
 * on each row with `v-bind="staggerIn(index)"`. Each page of a list starts
 * over, so rows from Load more don't wait behind the ones above them.
 */
export function staggerIn(index: number) {
    const step = Math.min(index % DEFAULT_PAGE_SIZE, MAX_STEPS);
    return {
        class: 'motion-safe:animate-in fade-in slide-in-from-bottom-2 animation-duration-300 fill-mode-backwards ease-out',
        style: { animationDelay: `${step * STEP_MS}ms` },
    };
}
