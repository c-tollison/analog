<script setup lang="ts">
import CoverImage from '@/components/CoverImage.vue';
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from '@/components/shadcn-components/item';
import { type EditionRow, editionSummary } from '@/lib/editions';

defineProps<{
    edition: EditionRow;
    // Shown when the edition has no title of its own.
    fallbackTitle: string;
}>();
</script>

<template>
    <Item variant="outline" size="sm">
        <ItemMedia>
            <CoverImage
                size="sm"
                :src="edition.coverUrl"
                :alt="edition.title ?? fallbackTitle"
                class="aspect-2/3 w-8"
            />
        </ItemMedia>
        <ItemContent class="min-w-0">
            <ItemTitle class="line-clamp-2">
                {{ edition.title ?? fallbackTitle }}
            </ItemTitle>
            <ItemDescription>{{ editionSummary(edition) }}</ItemDescription>
        </ItemContent>
        <ItemActions>
            <slot />
        </ItemActions>
    </Item>
</template>
