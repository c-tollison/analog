<script setup lang="ts">
import {
    EDITION_FORMAT_LABELS,
    isbn10From13,
    languageName,
    PERSON_ROLE_LABELS,
} from '@analog/types';
import CoverImage from '@/components/CoverImage.vue';
import { Badge } from '@/components/shadcn-components/badge';
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from '@/components/shadcn-components/item';
import type { ItemEdition } from '@/composables/useItems';
import { formatDate } from '@/lib/dates';

import { computed } from 'vue';

// One edition on a book's page: its cover, what kind of copy it is, and its
// facts in a grid. The default slot adds badges, like the shelves that own
// it, and the actions slot adds buttons.
const props = defineProps<{
    edition: ItemEdition;
    // Shown when the edition has no title of its own.
    fallbackTitle: string;
}>();

// Read as local time, so the day doesn't shift back a day.
const released = computed(() => {
    const { releaseDate, releaseYear } = props.edition;
    return releaseDate
        ? formatDate(`${releaseDate}T00:00:00`)
        : (releaseYear?.toString() ?? null);
});

// The facts that are known, in reading order. Credits come last.
const facts = computed(() => {
    const { edition } = props;
    const credits = new Map<string, string[]>();
    for (const { role, name } of edition.credits) {
        const label = PERSON_ROLE_LABELS[role];
        credits.set(label, [...(credits.get(label) ?? []), name]);
    }
    return [
        {
            label: 'Publisher',
            value:
                edition.publisher && edition.imprintOf
                    ? `${edition.publisher} (${edition.imprintOf})`
                    : edition.publisher,
        },
        { label: 'Released', value: released.value },
        { label: 'Pages', value: edition.pageCount?.toString() },
        { label: 'ISBN-13', value: edition.isbn },
        { label: 'ISBN-10', value: isbn10From13(edition.isbn) },
        ...[...credits].map(([label, names]) => ({
            label,
            value: names.join(', '),
        })),
    ].filter((fact): fact is { label: string; value: string } => !!fact.value);
});
</script>

<template>
    <Item variant="outline" class="items-start">
        <ItemMedia>
            <CoverImage
                size="sm"
                :src="edition.coverUrl"
                :alt="edition.title ?? fallbackTitle"
                class="aspect-2/3 w-16"
            />
        </ItemMedia>
        <ItemContent class="min-w-0 gap-2">
            <div class="grid gap-0.5">
                <ItemTitle class="line-clamp-2">
                    {{ edition.title ?? fallbackTitle }}
                </ItemTitle>
                <ItemDescription v-if="edition.editionName">
                    {{ edition.editionName }}
                </ItemDescription>
            </div>
            <div class="flex flex-wrap gap-1">
                <Badge v-if="edition.format" variant="secondary">
                    {{ EDITION_FORMAT_LABELS[edition.format] }}
                </Badge>
                <Badge v-if="languageName(edition.language)" variant="outline">
                    {{ languageName(edition.language) }}
                </Badge>
                <slot />
            </div>
            <dl
                class="grid grid-cols-2 gap-x-6 gap-y-2 pt-1 text-xs sm:grid-cols-3"
            >
                <div v-for="fact in facts" :key="fact.label" class="min-w-0">
                    <dt class="text-muted-foreground">{{ fact.label }}</dt>
                    <dd class="truncate font-medium" :title="fact.value">
                        {{ fact.value }}
                    </dd>
                </div>
            </dl>
        </ItemContent>
        <ItemActions v-if="$slots.actions" class="self-start">
            <slot name="actions" />
        </ItemActions>
    </Item>
</template>
