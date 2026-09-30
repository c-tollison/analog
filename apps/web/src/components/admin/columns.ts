import AddedHeader from '@/components/admin/AddedHeader.vue';
import CoverImage from '@/components/CoverImage.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { formatDate } from '@/lib/dates';

import { SparklesIcon } from '@lucide/vue';
import type { ColumnDef, RowData } from '@tanstack/vue-table';
import { h } from 'vue';
import { type RouteLocationRaw, RouterLink } from 'vue-router';

declare module '@tanstack/vue-table' {
    interface ColumnMeta<TData extends RowData, TValue> {
        // Classes for the column's header and cells, e.g. to hide it on phones.
        class?: string;
    }
}

// Columns both admin tables share.

/** Only shown on wide screens. The title shows the same details on phones. */
export const WIDE_ONLY = { class: 'hidden md:table-cell' };

export function coverColumn<
    T extends { coverUrl: string | null },
>(): ColumnDef<T> {
    return {
        id: 'cover',
        header: '',
        cell: ({ row }) =>
            h(CoverImage, {
                size: 'sm',
                src: row.original.coverUrl,
                alt: '',
                // Without max-w-none, a squeezed cell on a phone shrinks
                // the cover to nothing.
                class: 'h-12 w-8 max-w-none',
            }),
    };
}

/**
 * The title as a link, with a badge once it's verified. On phones, `details`
 * shows under it in place of the columns that hide.
 */
export function titleColumn<
    T extends { title: string; verifiedAt: string | null },
>(
    to: (row: T) => RouteLocationRaw,
    details: (row: T) => string | null
): ColumnDef<T> {
    return {
        id: 'title',
        header: 'Title',
        meta: { class: 'w-full whitespace-normal md:w-auto' },
        cell: ({ row }) => {
            const text = details(row.original);
            return h('div', { class: 'grid gap-0.5' }, [
                h('div', { class: 'flex flex-wrap items-center gap-x-2' }, [
                    h(
                        RouterLink,
                        {
                            to: to(row.original),
                            class: 'font-medium hover:underline',
                            // The row opens it too.
                            onClick: (event: MouseEvent) =>
                                event.stopPropagation(),
                        },
                        () => row.original.title
                    ),
                    row.original.verifiedAt
                        ? h(Badge, { variant: 'secondary' }, () => 'Verified')
                        : null,
                ]),
                text
                    ? h(
                          'span',
                          { class: 'text-muted-foreground md:hidden' },
                          text
                      )
                    : null,
            ]);
        },
    };
}

/** How many suggestions `pnpm catalog:check` left, when there are any. */
export function suggestionsColumn<
    T extends { suggestions: number },
>(): ColumnDef<T> {
    return {
        id: 'suggestions',
        header: '',
        cell: ({ row }) =>
            row.original.suggestions
                ? h(
                      Badge,
                      {
                          variant: 'outline',
                          title: `${row.original.suggestions} suggestions`,
                      },
                      () => [h(SparklesIcon), row.original.suggestions]
                  )
                : null,
    };
}

/** When it was added. Its header flips between newest and oldest first. */
export function addedColumn<T extends { createdAt: string }>(): ColumnDef<T> {
    return {
        id: 'createdAt',
        accessorFn: (row) => row.createdAt,
        header: ({ column }) =>
            h(AddedHeader, {
                newestFirst: column.getIsSorted() === 'desc',
                onToggle: () => column.toggleSorting(),
            }),
        cell: ({ row }) => formatDate(row.original.createdAt),
        meta: { class: 'hidden sm:table-cell' },
    };
}
