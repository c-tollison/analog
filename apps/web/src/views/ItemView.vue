<script setup lang="ts">
import {
    EDITION_FORMAT_LABELS,
    EditionFormat,
    PersonRole,
    ProgressStatus,
} from '@analog/types';
import BackButton from '@/components/BackButton.vue';
import CoverImage from '@/components/CoverImage.vue';
import AddToShelfDialog from '@/components/collections/AddToShelfDialog.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import EditionCard from '@/components/media/EditionCard.vue';
import MediaDetails from '@/components/media/MediaDetails.vue';
import LogButton from '@/components/progress/LogButton.vue';
import ReviewSheet from '@/components/progress/ReviewSheet.vue';
import StarRating from '@/components/progress/StarRating.vue';
import ReturnLink from '@/components/ReturnLink.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemMedia,
    ItemTitle,
} from '@/components/shadcn-components/item';
import { Separator } from '@/components/shadcn-components/separator';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/shadcn-components/tabs';
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/shadcn-components/toggle-group';
import UserAvatar from '@/components/users/UserAvatar.vue';
import WithTooltip from '@/components/WithTooltip.vue';
import {
    useItem,
    useItemEditions,
    useItemReviews,
} from '@/composables/useItems';
import { usePageTitle } from '@/composables/usePageTitle';
import { useQueryParam } from '@/composables/useQueryParam';
import { SERIES_KIND_LABELS } from '@/lib/book-labels';
import { creditLines } from '@/lib/credits';
import { formatDate } from '@/lib/dates';
import { staggerIn } from '@/lib/motion';

import { LibraryBigIcon, PencilIcon, PlusIcon, StarIcon } from '@lucide/vue';
import { computed, ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

const props = defineProps<{ id: string }>();

const { data: item, error: loadError } = useItem(() => props.id);
usePageTitle(() => item.value?.title);

// The open tab lives in the URL so coming back from a profile lands on
// Reviews.
const tab = useQueryParam('tab', ['details', 'editions', 'reviews'], 'details');

// The editions tab's format filter. "all" shows every edition.
const ALL_FORMATS = 'all';
const formatFilter = useQueryParam(
    'format',
    [ALL_FORMATS, ...Object.values(EditionFormat)],
    ALL_FORMATS
);
const pickedFormat = computed(() =>
    formatFilter.value === ALL_FORMATS ? null : formatFilter.value
);

// Chips for the formats this book has editions in. Editions with no format
// only show under All.
const formatChips = computed(() =>
    (item.value?.editionFormats ?? []).flatMap(({ format, count }) =>
        format ? [{ format, count }] : []
    )
);

function onFormat(value: unknown) {
    formatFilter.value =
        Object.values(EditionFormat).find((format) => format === value) ??
        ALL_FORMATS;
}

// Each list loads when its tab is first opened.
const editions = useItemEditions(() => props.id, {
    enabled: () => tab.value === 'editions',
    format: pickedFormat,
});
const reviews = useItemReviews(() => props.id, {
    enabled: () => tab.value === 'reviews',
});

const credits = computed(() =>
    item.value ? creditLines(item.value.credits) : []
);

const isCompleted = computed(
    () => item.value?.status === ProgressStatus.Completed
);
const hasReview = computed(
    () => !!item.value && (item.value.rating !== null || !!item.value.review)
);
const isReviewOpen = ref(false);
const isAddOpen = ref(false);
// The edition the dialog opens on, or null for the whole book.
const addingIsbn = ref<string | null>(null);

function addToShelf(isbn: string | null) {
    addingIsbn.value = isbn;
    isAddOpen.value = true;
}

// Out of 5 stars, like the rating picker.
const averageStars = computed(() =>
    item.value?.ratingAverage != null
        ? (item.value.ratingAverage / 2).toFixed(1)
        : null
);

function shelvesOwning(isbn: string): string[] {
    return (item.value?.shelves ?? [])
        .filter((row) => row.isbn === isbn)
        .map((row) => row.name);
}

// The API sends one row per shelf and edition; the page lists each shelf
// once with how many editions it owns.
const shelves = computed(() => {
    const grouped = new Map<
        string,
        { id: string; name: string; count: number }
    >();
    for (const row of item.value?.shelves ?? []) {
        const shelf = grouped.get(row.id);
        if (shelf) shelf.count++;
        else grouped.set(row.id, { id: row.id, name: row.name, count: 1 });
    }
    return [...grouped.values()];
});

const back = computed<{ to: RouteLocationRaw; text: string }>(() =>
    item.value?.seriesId
        ? {
              to: { name: 'series', params: { id: item.value.seriesId } },
              text: 'Back to series',
          }
        : { to: { name: 'collections' }, text: 'Back to shelves' }
);
</script>

<template>
    <div class="flex flex-col gap-4">
        <div>
            <BackButton :to="back.to" :text="back.text" />
        </div>

        <FormError :message="loadError?.message ?? null" />

        <div v-if="!item && !loadError" class="flex justify-center p-8">
            <Spinner class="size-6" />
        </div>

        <Tabs
            v-if="item"
            v-model="tab"
            class="motion-safe:animate-in fade-in animation-duration-500 gap-4"
        >
            <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger v-if="item.editionCount" value="editions">
                    Editions ({{ item.editionCount }})
                </TabsTrigger>
                <TabsTrigger value="reviews">
                    Reviews
                    <template v-if="item.reviewCount">
                        ({{ item.reviewCount }})
                    </template>
                </TabsTrigger>
            </TabsList>

            <TabsContent value="details" class="grid gap-4">
                <div class="grid gap-6 sm:grid-cols-[12rem_1fr]">
                    <CoverImage
                        size="lg"
                        :src="item.coverUrl"
                        :alt="item.title"
                        class="mx-auto aspect-2/3 w-40 sm:w-full"
                    />

                    <div class="grid min-w-0 content-start gap-4">
                        <div class="grid gap-1">
                            <ReturnLink
                                v-if="item.seriesId"
                                :to="{
                                    name: 'series',
                                    params: { id: item.seriesId },
                                }"
                                class="text-muted-foreground text-sm underline underline-offset-4"
                            >
                                {{ item.seriesTitle }}
                                <template v-if="item.position !== null">
                                    · Vol. {{ item.position }}
                                    <template v-if="item.volumeCount">
                                        of {{ item.volumeCount }}
                                    </template>
                                </template>
                            </ReturnLink>
                            <h1 class="text-2xl font-semibold text-balance">
                                {{ item.title }}
                            </h1>
                            <p
                                v-if="item.subtitle"
                                class="text-muted-foreground"
                            >
                                {{ item.subtitle }}
                            </p>
                            <div
                                v-if="credits.length"
                                class="grid gap-0.5 text-sm"
                            >
                                <p
                                    v-for="line in credits"
                                    :key="line.role"
                                    :class="{
                                        'text-muted-foreground':
                                            line.role !== PersonRole.Author,
                                    }"
                                >
                                    {{
                                        line.role === PersonRole.Author
                                            ? line.names.join(', ')
                                            : line.text
                                    }}
                                </p>
                            </div>
                            <div class="flex flex-wrap items-center gap-2 pt-1">
                                <Badge variant="secondary">
                                    {{
                                        item.kind
                                            ? SERIES_KIND_LABELS[item.kind]
                                            : 'Book'
                                    }}
                                </Badge>
                                <span
                                    class="text-muted-foreground flex items-center gap-1 text-xs"
                                >
                                    {{ item.saveCount }}
                                    {{ item.saveCount === 1 ? 'save' : 'saves' }}
                                    <template
                                        v-if="
                                            averageStars &&
                                            item.ratingAverage !== null
                                        "
                                    >
                                        ·
                                        <StarRating
                                            readonly
                                            :model-value="
                                                Math.round(item.ratingAverage)
                                            "
                                        />
                                        {{ averageStars }}
                                        ({{ item.ratingCount }})
                                    </template>
                                </span>
                            </div>
                        </div>

                        <div class="flex flex-wrap items-center gap-2">
                            <LogButton
                                :catalog-item-id="item.id"
                                :title="item.title"
                                :status="item.status"
                            />
                            <Button variant="outline" @click="addToShelf(null)">
                                <PlusIcon />
                                Add to shelf
                            </Button>
                            <StarRating
                                v-if="isCompleted && item.rating !== null"
                                readonly
                                :model-value="item.rating"
                            />
                        </div>

                        <section v-if="shelves.length" class="grid gap-2">
                            <h2 class="text-sm font-semibold">
                                On your shelves
                            </h2>
                            <ItemGroup class="grid gap-2">
                                <Item
                                    v-for="(shelf, index) in shelves"
                                    v-bind="staggerIn(index)"
                                    :key="shelf.id"
                                    variant="outline"
                                    size="sm"
                                    as-child
                                >
                                    <ReturnLink
                                        :to="{
                                            name: 'collection',
                                            params: { id: shelf.id },
                                        }"
                                    >
                                        <ItemMedia variant="icon">
                                            <LibraryBigIcon />
                                        </ItemMedia>
                                        <ItemContent>
                                            <ItemTitle
                                                >{{ shelf.name }}</ItemTitle
                                            >
                                            <ItemDescription>
                                                {{ shelf.count }}
                                                {{
                                                    shelf.count === 1
                                                        ? 'edition'
                                                        : 'editions'
                                                }}
                                            </ItemDescription>
                                        </ItemContent>
                                    </ReturnLink>
                                </Item>
                            </ItemGroup>
                        </section>

                        <MediaDetails
                            :description="item.description"
                            :facts="item.facts"
                        />
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="editions" class="grid gap-3">
                <ToggleGroup
                    v-if="formatChips.length > 1"
                    type="single"
                    variant="outline"
                    size="sm"
                    :spacing="1"
                    class="flex-wrap justify-start"
                    :model-value="formatFilter"
                    @update:model-value="onFormat"
                >
                    <ToggleGroupItem :value="ALL_FORMATS">
                        All {{ item.editionCount }}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                        v-for="chip in formatChips"
                        :key="chip.format"
                        :value="chip.format"
                    >
                        {{ EDITION_FORMAT_LABELS[chip.format] }}
                        {{ chip.count }}
                    </ToggleGroupItem>
                </ToggleGroup>
                <PagedList :list="editions" empty-text="No editions yet.">
                    <template #default="{ items }">
                        <ItemGroup class="grid gap-2">
                            <EditionCard
                                v-for="(edition, index) in items"
                                v-bind="staggerIn(index)"
                                :key="edition.isbn"
                                :edition="edition"
                                :fallback-title="item.title"
                            >
                                <Badge v-if="edition.pending" variant="outline">
                                    Unreviewed
                                </Badge>
                                <Badge
                                    v-for="name in shelvesOwning(edition.isbn)"
                                    :key="name"
                                    variant="secondary"
                                >
                                    {{ name }}
                                </Badge>
                                <template #actions>
                                    <WithTooltip label="Add to shelf">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            :aria-label="`Add ${edition.isbn} to a shelf`"
                                            @click="addToShelf(edition.isbn)"
                                        >
                                            <LibraryBigIcon />
                                        </Button>
                                    </WithTooltip>
                                </template>
                            </EditionCard>
                        </ItemGroup>
                    </template>
                </PagedList>
            </TabsContent>

            <TabsContent value="reviews" class="grid gap-4">
                <section v-if="isCompleted" class="grid gap-3">
                    <div class="flex items-center justify-between">
                        <h2 class="font-semibold">Your review</h2>
                        <Button
                            variant="outline"
                            size="sm"
                            @click="isReviewOpen = true"
                        >
                            <PencilIcon v-if="hasReview" />
                            <StarIcon v-else />
                            {{ hasReview ? 'Edit' : 'Rate' }}
                        </Button>
                    </div>
                    <p class="text-muted-foreground text-sm">
                        {{
                            item.completedAt
                                ? `Finished ${formatDate(item.completedAt)}`
                                : 'No finish date'
                        }}
                    </p>
                    <StarRating
                        v-if="item.rating !== null"
                        readonly
                        :model-value="item.rating"
                    />
                    <p v-if="item.review" class="text-sm whitespace-pre-line">
                        {{ item.review }}
                    </p>
                </section>
                <Separator v-if="isCompleted" />
                <PagedList :list="reviews" empty-text="No reviews yet.">
                    <template #default="{ items: page }">
                        <ItemGroup class="grid gap-2 sm:grid-cols-2">
                            <Item
                                v-for="(review, index) in page"
                                v-bind="staggerIn(index)"
                                :key="review.id"
                                variant="outline"
                                class="items-start"
                            >
                                <ItemMedia>
                                    <UserAvatar
                                        :name="review.name"
                                        :image="review.image"
                                    />
                                </ItemMedia>
                                <ItemContent class="min-w-0 gap-1">
                                    <ItemTitle>
                                        <RouterLink
                                            :to="{
                                                name: 'user',
                                                params: {
                                                    username: review.username,
                                                },
                                            }"
                                            class="underline-offset-2 hover:underline"
                                        >
                                            {{ review.name }}
                                        </RouterLink>
                                    </ItemTitle>
                                    <StarRating
                                        v-if="review.rating !== null"
                                        readonly
                                        :model-value="review.rating"
                                    />
                                    <p
                                        v-if="review.review"
                                        class="text-sm whitespace-pre-line"
                                    >
                                        {{ review.review }}
                                    </p>
                                </ItemContent>
                            </Item>
                        </ItemGroup>
                    </template>
                </PagedList>
            </TabsContent>
        </Tabs>

        <AddToShelfDialog
            v-if="item"
            v-model:open="isAddOpen"
            :catalog-item-id="item.id"
            :title="item.title"
            :isbn="addingIsbn"
        />

        <ReviewSheet
            v-if="item && isCompleted"
            v-model:open="isReviewOpen"
            :catalog-item-id="item.id"
            :title="item.title"
            :rating="item.rating"
            :review="item.review"
            :completed-at="item.completedAt"
        />
    </div>
</template>
