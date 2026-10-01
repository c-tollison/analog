<script setup lang="ts">
import CoverImage from '@/components/CoverImage.vue';
import LogButton from '@/components/progress/LogButton.vue';
import { Badge } from '@/components/shadcn-components/badge';
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from '@/components/shadcn-components/item';
import type { BookSearchResult } from '@/composables/useItems';
import { formatStatusLabels } from '@/lib/media-types';

import { StarIcon } from '@lucide/vue';
import { computed } from 'vue';

const props = defineProps<{ book: BookSearchResult }>();

// "#1 of 30 in Jujutsu Kaisen", or "#1 in …" when the total isn't known.
const placement = computed(() => {
    const { seriesTitle, position, volumeCount } = props.book;
    if (!seriesTitle || position === null) return null;
    const total = volumeCount ? ` of ${volumeCount}` : '';
    return `#${position}${total} in ${seriesTitle}`;
});

const facts = computed(() => {
    const { author, releaseDate, saveCount } = props.book;
    return [
        author,
        releaseDate?.slice(0, 4),
        `${saveCount} ${saveCount === 1 ? 'save' : 'saves'}`,
    ].filter(Boolean);
});

// Out of 5 stars, like the rating picker.
const averageStars = computed(() =>
    props.book.ratingAverage !== null
        ? (props.book.ratingAverage / 2).toFixed(1)
        : null
);
</script>

<!-- The whole row opens the book; the Log button sits above the link so it
stays clickable. -->
<template>
    <Item variant="outline" size="sm" class="has-[a:hover]:bg-muted relative">
        <ItemMedia>
            <CoverImage
                size="sm"
                :src="book.coverUrl"
                :alt="book.title"
                class="aspect-2/3 w-12"
            />
        </ItemMedia>
        <ItemContent class="min-w-0 gap-1">
            <div v-if="placement || book.isUnreviewed" class="flex gap-1">
                <Badge v-if="placement" variant="secondary" class="truncate">
                    {{ placement }}
                </Badge>
                <Badge v-if="book.isUnreviewed" variant="outline">
                    Unreviewed
                </Badge>
            </div>
            <ItemTitle class="w-full">
                <RouterLink
                    :to="{ name: 'item', params: { id: book.id } }"
                    class="line-clamp-2 after:absolute after:inset-0"
                >
                    {{ book.title }}
                </RouterLink>
            </ItemTitle>
            <ItemDescription class="flex items-center gap-1">
                {{ facts.join(' · ') }}
                <template v-if="averageStars">
                    · {{ averageStars }}
                    <StarIcon class="size-3" />
                </template>
            </ItemDescription>
        </ItemContent>
        <ItemActions class="relative">
            <LogButton
                :catalog-item-id="book.id"
                :title="book.title"
                :status="book.status"
                :labels="formatStatusLabels(book.format)"
            />
        </ItemActions>
    </Item>
</template>
