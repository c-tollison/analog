<script setup lang="ts">
import { ProgressStatus } from '@analog/types';
import BackButton from '@/components/BackButton.vue';
import CoverImage from '@/components/CoverImage.vue';
import AddEditionDialog from '@/components/collections/AddEditionDialog.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import EditionItem from '@/components/media/EditionItem.vue';
import MediaDetails from '@/components/media/MediaDetails.vue';
import ReviewSheet from '@/components/progress/ReviewSheet.vue';
import StarRating from '@/components/progress/StarRating.vue';
import StatusPicker from '@/components/progress/StatusPicker.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import {
    Item,
    ItemContent,
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
import UserAvatar from '@/components/users/UserAvatar.vue';
import {
    useAddOwnedEdition,
    useCollectionItem,
    useCollectionItemReviews,
    useRemoveOwnedEdition,
} from '@/composables/useCollections';
import { useSetProgressStatus } from '@/composables/useProgress';
import { isPendingFor } from '@/lib/editions';
import {
    FORMAT_LABELS,
    formatStatusLabels,
    SERIES_KIND_LABELS,
} from '@/lib/media-types';

import { PencilIcon, PlusIcon, StarIcon } from '@lucide/vue';
import { computed, ref } from 'vue';
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router';

const TABS = ['details', 'editions', 'reviews'] as const;
type Tab = (typeof TABS)[number];

function isTab(value: unknown): value is Tab {
    return TABS.some((tab) => tab === value);
}

const props = defineProps<{ id: string; itemId: string }>();

const route = useRoute();
const router = useRouter();

const { data: item, error: loadError } = useCollectionItem(
    () => props.id,
    () => props.itemId
);

// The open tab lives in the URL so coming back from a profile lands on
// Reviews.
const tab = computed({
    get: (): Tab => (isTab(route.query.tab) ? route.query.tab : 'details'),
    set: (value) => {
        router.replace({ query: { ...route.query, tab: value } });
    },
});

// Loads when the Reviews tab is first opened.
const reviews = useCollectionItemReviews(
    () => props.id,
    () => props.itemId,
    { enabled: () => tab.value === 'reviews' }
);

const labels = computed(() =>
    item.value ? formatStatusLabels(item.value.format) : null
);

const {
    mutate: setStatus,
    isPending: isSettingStatus,
    variables: statusVariables,
    error: statusError,
} = useSetProgressStatus();

// Show the picked status while it saves.
const shownStatus = computed(() =>
    isSettingStatus.value && statusVariables.value
        ? statusVariables.value.status
        : (item.value?.status ?? null)
);

function onStatus(status: ProgressStatus | null) {
    if (!item.value) return;
    setStatus(
        { catalogItemId: item.value.catalogItemId, status },
        {
            onSuccess: () => {
                if (status === ProgressStatus.Completed && !hasReview.value) {
                    isReviewOpen.value = true;
                }
            },
        }
    );
}

const isCompleted = computed(
    () => item.value?.status === ProgressStatus.Completed
);
const hasReview = computed(
    () => !!item.value && (item.value.rating !== null || !!item.value.review)
);
const isReviewOpen = ref(false);
const isAddEditionOpen = ref(false);

const back = computed<{ to: RouteLocationRaw; text: string }>(() =>
    item.value?.seriesId
        ? {
              to: {
                  name: 'collection-series',
                  params: { id: props.id, seriesId: item.value.seriesId },
              },
              text: 'Back to series',
          }
        : {
              to: { name: 'collection', params: { id: props.id } },
              text: 'Back to collection',
          }
);

const addOwned = useAddOwnedEdition();
const removeOwned = useRemoveOwnedEdition();
const isChangingOwned = computed(
    () => addOwned.isPending.value || removeOwned.isPending.value
);

function editionVariables(isbn: string) {
    return { collectionId: props.id, itemId: props.itemId, isbn };
}

const error = computed(
    () =>
        (
            loadError.value ??
            statusError.value ??
            addOwned.error.value ??
            removeOwned.error.value
        )?.message ?? null
);
</script>

<template>
    <div class="flex flex-col gap-4">
        <div>
            <BackButton :to="back.to" :text="back.text" />
        </div>

        <FormError :message="error" />

        <div v-if="!item && !loadError" class="flex justify-center p-8">
            <Spinner class="size-6" />
        </div>

        <Tabs v-if="item && labels" v-model="tab" class="gap-4">
            <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger v-if="item.editions.length" value="editions">
                    Editions ({{ item.editions.length }})
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
                            <RouterLink
                                v-if="item.seriesId"
                                :to="{
                                name: 'collection-series',
                                params: { id, seriesId: item.seriesId },
                            }"
                                class="text-muted-foreground text-sm hover:underline"
                            >
                                {{ item.seriesTitle }}
                                <template v-if="item.position !== null">
                                    · Vol. {{ item.position }}
                                </template>
                            </RouterLink>
                            <h1 class="text-2xl font-semibold text-balance">
                                {{ item.title }}
                            </h1>
                            <p
                                v-if="item.subtitle"
                                class="text-muted-foreground"
                            >
                                {{ item.subtitle }}
                            </p>
                            <p v-if="item.creators.length" class="text-sm">
                                {{ item.creators.join(', ') }}
                            </p>
                            <div class="flex flex-wrap items-center gap-2 pt-1">
                                <Badge variant="secondary">
                                    {{
                                    item.kind
                                        ? SERIES_KIND_LABELS[item.kind]
                                        : FORMAT_LABELS[item.format]
                                    }}
                                </Badge>
                                <StarRating
                                    v-if="isCompleted && item.rating !== null"
                                    readonly
                                    :model-value="item.rating"
                                />
                            </div>
                        </div>

                        <StatusPicker
                            :labels="labels"
                            :model-value="shownStatus"
                            :disabled="isSettingStatus"
                            class="sm:max-w-md"
                            @update:model-value="onStatus"
                        />

                        <MediaDetails
                            :description="item.description"
                            :facts="item.facts"
                        />
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="editions" class="grid gap-3">
                <div class="flex justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        @click="isAddEditionOpen = true"
                    >
                        <PlusIcon />
                        Add an edition
                    </Button>
                </div>
                <ItemGroup class="grid gap-2">
                    <EditionItem
                        v-for="edition in item.editions"
                        :key="edition.isbn"
                        :edition="edition"
                        :fallback-title="item.title"
                    >
                        <template v-if="item.ownedIsbns.includes(edition.isbn)">
                            <Badge variant="secondary">Yours</Badge>
                            <Button
                                variant="ghost"
                                size="sm"
                                :disabled="isChangingOwned"
                                @click="
                                    removeOwned.mutate(
                                        editionVariables(edition.isbn)
                                    )
                                "
                            >
                                <Spinner
                                    v-if="isPendingFor(removeOwned, edition.isbn)"
                                />
                                Remove
                            </Button>
                        </template>
                        <Button
                            v-else
                            variant="outline"
                            size="sm"
                            :disabled="isChangingOwned"
                            @click="addOwned.mutate(editionVariables(edition.isbn))"
                        >
                            <Spinner
                                v-if="isPendingFor(addOwned, edition.isbn)"
                            />
                            I own this
                        </Button>
                    </EditionItem>
                </ItemGroup>
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
                                v-for="review in page"
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

        <AddEditionDialog
            v-if="item"
            v-model:open="isAddEditionOpen"
            :collection-id="id"
            :item-id="itemId"
            :title="item.title"
        />

        <ReviewSheet
            v-if="item && isCompleted"
            v-model:open="isReviewOpen"
            :catalog-item-id="item.catalogItemId"
            :title="item.title"
            :rating="item.rating"
            :review="item.review"
        />
    </div>
</template>
