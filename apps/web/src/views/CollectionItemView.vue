<script setup lang="ts">
import { ProgressStatus } from '@analog/types';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import MediaDetails from '@/components/media/MediaDetails.vue';
import ReviewForm from '@/components/progress/ReviewForm.vue';
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
import UserAvatar from '@/components/users/UserAvatar.vue';
import { useCollectionItem } from '@/composables/useCollections';
import { useSetProgressStatus } from '@/composables/useProgress';
import {
    FORMAT_LABELS,
    formatStatusLabels,
    SERIES_KIND_LABELS,
} from '@/lib/media-types';

import { ArrowLeftIcon, PencilIcon } from '@lucide/vue';
import { computed, ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

const props = defineProps<{ id: string; itemId: string }>();

const { data: item, error: loadError } = useCollectionItem(
    () => props.id,
    () => props.itemId
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
    setStatus({ catalogItemId: item.value.catalogItemId, status });
}

const isCompleted = computed(
    () => item.value?.status === ProgressStatus.Completed
);
const hasReview = computed(
    () => !!item.value && (item.value.rating !== null || !!item.value.review)
);
const isEditingReview = ref(false);

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

const error = computed(
    () => (loadError.value ?? statusError.value)?.message ?? null
);
</script>

<template>
    <main class="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
        <div>
            <Button variant="ghost" size="sm" as-child>
                <RouterLink :to="back.to">
                    <ArrowLeftIcon />
                    {{ back.text }}
                </RouterLink>
            </Button>
        </div>

        <FormError :message="error" />

        <div v-if="!item && !loadError" class="flex justify-center p-8">
            <Spinner class="size-6" />
        </div>

        <template v-if="item && labels">
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
                        <p v-if="item.subtitle" class="text-muted-foreground">
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
                        :links="item.links"
                    />
                </div>
            </div>

            <template v-if="isCompleted">
                <Separator />
                <section class="grid gap-3 sm:max-w-xl">
                    <div class="flex items-center justify-between">
                        <h2 class="font-semibold">Your review</h2>
                        <Button
                            v-if="hasReview && !isEditingReview"
                            variant="outline"
                            size="sm"
                            @click="isEditingReview = true"
                        >
                            <PencilIcon />
                            Edit
                        </Button>
                    </div>
                    <ReviewForm
                        v-if="isEditingReview || !hasReview"
                        :catalog-item-id="item.catalogItemId"
                        :rating="item.rating"
                        :review="item.review"
                        :can-cancel="hasReview"
                        @done="isEditingReview = false"
                    />
                    <template v-else>
                        <StarRating
                            v-if="item.rating !== null"
                            readonly
                            :model-value="item.rating"
                        />
                        <p
                            v-if="item.review"
                            class="text-sm whitespace-pre-line"
                        >
                            {{ item.review }}
                        </p>
                    </template>
                </section>
            </template>

            <template v-if="item.members.length">
                <Separator />
                <section class="grid gap-3">
                    <h2 class="font-semibold">Others in this collection</h2>
                    <ItemGroup class="grid gap-2 sm:grid-cols-2">
                        <Item
                            v-for="member in item.members"
                            :key="member.id"
                            variant="outline"
                            class="items-start"
                        >
                            <ItemMedia>
                                <UserAvatar
                                    :name="member.name"
                                    :image="member.image"
                                />
                            </ItemMedia>
                            <ItemContent class="min-w-0 gap-1">
                                <ItemTitle>
                                    <RouterLink
                                        :to="{
                                            name: 'user',
                                            params: {
                                                username: member.username,
                                            },
                                        }"
                                        class="hover:underline"
                                    >
                                        {{ member.name }}
                                    </RouterLink>
                                </ItemTitle>
                                <div class="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">
                                        {{ labels[member.status] }}
                                    </Badge>
                                    <StarRating
                                        v-if="member.rating !== null"
                                        readonly
                                        :model-value="member.rating"
                                    />
                                </div>
                                <p
                                    v-if="member.review"
                                    class="text-sm whitespace-pre-line"
                                >
                                    {{ member.review }}
                                </p>
                            </ItemContent>
                        </Item>
                    </ItemGroup>
                </section>
            </template>
        </template>
    </main>
</template>
