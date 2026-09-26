import { formatTimeAgo } from '@vueuse/core';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/** "Sep 26, 2026" */
export function formatDate(iso: string): string {
    return dateFormat.format(new Date(iso));
}

/** "3 days ago", or "Never" when there's no date. */
export function timeAgo(iso: string | null): string {
    return iso ? formatTimeAgo(new Date(iso)) : 'Never';
}
