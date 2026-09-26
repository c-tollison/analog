import AddedHeader from '@/components/admin/AddedHeader.vue';
import CoverImage from '@/components/CoverImage.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { formatDate } from '@/lib/dates';

import type { ColumnDef } from '@tanstack/vue-table';
import { h } from 'vue';
import { type RouteLocationRaw, RouterLink } from 'vue-router';

// Columns both admin tables share.

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
                class: 'h-12 w-8',
            }),
    };
}

/** The title as a link, with a badge once it's verified. */
export function titleColumn<
    T extends { title: string; verifiedAt: string | null },
>(to: (row: T) => RouteLocationRaw): ColumnDef<T> {
    return {
        id: 'title',
        header: 'Title',
        cell: ({ row }) =>
            h('div', { class: 'flex items-center gap-2' }, [
                h(
                    RouterLink,
                    {
                        to: to(row.original),
                        class: 'font-medium hover:underline',
                        // The row opens it too.
                        onClick: (event: MouseEvent) => event.stopPropagation(),
                    },
                    () => row.original.title
                ),
                row.original.verifiedAt
                    ? h(Badge, { variant: 'secondary' }, () => 'Verified')
                    : null,
            ]),
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
    };
}
