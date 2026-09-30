<script setup lang="ts">
import { MediaFormat } from '@analog/types';
import AdminItemForm from '@/components/admin/AdminItemForm.vue';
import CheckList from '@/components/admin/CheckList.vue';
import IsbnTitleDialog from '@/components/admin/IsbnTitleDialog.vue';
import MergeItemDialog from '@/components/admin/MergeItemDialog.vue';
import VerifiedBy from '@/components/admin/VerifiedBy.vue';
import BackButton from '@/components/BackButton.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import EditionItem from '@/components/media/EditionItem.vue';
import MediaDetails from '@/components/media/MediaDetails.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { ItemGroup } from '@/components/shadcn-components/item';
import { Separator } from '@/components/shadcn-components/separator';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    useAdminItem,
    useApproveIsbn,
    useDeleteAdminItem,
    useItemChecks,
    useSetItemVerified,
    useSplitIsbn,
    useUploadCover,
} from '@/composables/useAdmin';
import { useRefreshBook } from '@/composables/useCatalog';
import { usePageTitle } from '@/composables/usePageTitle';
import { formatDate, timeAgo } from '@/lib/dates';
import { isPendingFor } from '@/lib/editions';
import { FORMAT_LABELS, SERIES_KIND_LABELS } from '@/lib/media-types';
import { goBackOr } from '@/lib/navigation';

import {
    MergeIcon,
    PencilIcon,
    RefreshCwIcon,
    Trash2Icon,
    UploadIcon,
} from '@lucide/vue';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps<{ id: string }>();

const router = useRouter();

const { data: item, error: loadError } = useAdminItem(() => props.id);
const { data: checks } = useItemChecks(() => props.id);
usePageTitle(() => item.value?.title);

const setVerified = useSetItemVerified();
const refresh = useRefreshBook();
const remove = useDeleteAdminItem();
const split = useSplitIsbn();
const approve = useApproveIsbn();
const { upload: uploadCover, choose: chooseCover } = useUploadCover();

const confirmingDelete = ref(false);
const isMergeOpen = ref(false);
// The ISBN whose title is being edited.
const editing = ref<{ isbn: string; title: string | null } | null>(null);
const isTitleOpen = ref(false);

function editTitle(edition: { isbn: string; title: string | null }) {
    editing.value = edition;
    isTitleOpen.value = true;
}

const facts = computed(() => {
    if (!item.value) return [];
    const { value } = item;
    const facts = [
        { label: 'Format', value: FORMAT_LABELS[value.format] },
        // In a series, the series picker shows the kind.
        {
            label: 'Kind',
            value:
                value.kind && !value.seriesId
                    ? SERIES_KIND_LABELS[value.kind]
                    : null,
        },
        { label: 'Added by', value: value.addedBy },
        { label: 'Added', value: formatDate(value.createdAt) },
        { label: 'In collections', value: String(value.collectionCount) },
    ];
    if (value.format === MediaFormat.Book) {
        facts.push(
            {
                label: 'Google Books',
                value: timeAgo(value.googleBooksFetchedAt),
            },
            {
                label: 'Open Library',
                value: timeAgo(value.openLibraryFetchedAt),
            }
        );
    }
    return facts.filter(
        (fact): fact is { label: string; value: string } => !!fact.value
    );
});

const canRefresh = computed(
    () =>
        !!item.value &&
        !item.value.verifiedAt &&
        item.value.format === MediaFormat.Book &&
        item.value.isbns.some((edition) => edition.main)
);

const error = computed(
    () =>
        (
            loadError.value ??
            setVerified.error.value ??
            refresh.error.value ??
            remove.error.value ??
            split.error.value ??
            approve.error.value ??
            uploadCover.error.value
        )?.message ?? null
);

function onSplit(isbn: string) {
    split.mutate(
        { itemId: props.id, isbn },
        {
            onSuccess: ({ id }) =>
                router.push({ name: 'admin-item', params: { id } }),
        }
    );
}

function onDelete() {
    remove.mutate(props.id, {
        onSuccess: () => goBackOr(router, { name: 'admin' }),
        onSettled: () => {
            confirmingDelete.value = false;
        },
    });
}
</script>

<template>
    <div class="flex flex-col gap-4">
        <div>
            <BackButton :to="{ name: 'admin' }" text="Back to dashboard" />
        </div>

        <FormError :message="error" />

        <div v-if="!item && !loadError" class="flex justify-center p-8">
            <Spinner class="size-6" />
        </div>

        <template v-if="item">
            <ConfirmDialog
                v-model:open="confirmingDelete"
                :title="`Delete ${item.title}?`"
                description="It'll be removed from every collection, along with everyone's progress and reviews for it."
                confirm-text="Delete"
                :pending="remove.isPending.value"
                @confirm="onDelete"
            />
            <MergeItemDialog
                v-model:open="isMergeOpen"
                :item-id="item.id"
                :item-title="item.title"
            />
            <IsbnTitleDialog
                v-if="editing"
                v-model:open="isTitleOpen"
                :item-id="item.id"
                :isbn="editing.isbn"
                :title="editing.title"
            />

            <div class="grid gap-6 sm:grid-cols-[12rem_1fr]">
                <CoverImage
                    size="lg"
                    :src="item.coverUrl"
                    :alt="item.title"
                    class="mx-auto aspect-2/3 w-32 sm:w-full"
                />

                <div class="grid min-w-0 content-start gap-4">
                    <!-- Rebuilt when an accepted suggestion changes it. -->
                    <AdminItemForm
                        :key="`${item.id}:${item.title}:${item.position}:${item.seriesId}`"
                        :item="item"
                    />

                    <CheckList v-if="checks" :checks="checks" />

                    <div class="grid gap-2">
                        <div class="flex flex-wrap gap-2">
                            <Button
                                :variant="item.verifiedAt ? 'outline' : 'default'"
                                :disabled="setVerified.isPending.value"
                                @click="
                                setVerified.mutate({
                                    itemId: item.id,
                                    verified: !item.verifiedAt,
                                })
                            "
                            >
                                <Spinner v-if="setVerified.isPending.value" />
                                {{ item.verifiedAt ? 'Unverify' : 'Verify' }}
                            </Button>
                            <Button
                                v-if="canRefresh"
                                variant="outline"
                                :disabled="refresh.isPending.value"
                                @click="refresh.mutate({ catalogItemId: item.id })"
                            >
                                <Spinner v-if="refresh.isPending.value" />
                                <RefreshCwIcon v-else />
                                Refresh details
                            </Button>
                            <Button
                                variant="outline"
                                @click="isMergeOpen = true"
                            >
                                <MergeIcon />
                                Merge into…
                            </Button>
                            <Button
                                variant="outline"
                                @click="confirmingDelete = true"
                            >
                                <Trash2Icon />
                                Delete
                            </Button>
                        </div>
                        <VerifiedBy
                            v-if="item.verifiedAt"
                            :verified-at="item.verifiedAt"
                            :verified-by="item.verifiedBy"
                        />
                    </div>

                    <Separator />

                    <MediaDetails
                        :description="null"
                        :facts="facts"
                        :links="item.links"
                    />
                </div>
            </div>

            <template v-if="item.isbns.length">
                <Separator />

                <section class="grid gap-3">
                    <h2 class="font-semibold">ISBNs</h2>
                    <ItemGroup class="gap-2">
                        <EditionItem
                            v-for="edition in item.isbns"
                            :key="edition.isbn"
                            :edition="edition"
                            :fallback-title="edition.isbn"
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                @click="editTitle(edition)"
                            >
                                <PencilIcon />
                                Edit title
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                :disabled="uploadCover.isPending.value"
                                @click="
                                    chooseCover({
                                        itemId: item.id,
                                        isbn: edition.isbn,
                                    })
                                "
                            >
                                <Spinner
                                    v-if="isPendingFor(uploadCover, edition.isbn)"
                                />
                                <UploadIcon v-else />
                                Upload cover
                            </Button>
                            <Badge v-if="edition.main" variant="secondary">
                                Main
                            </Badge>
                            <template v-else>
                                <template v-if="edition.pending">
                                    <Badge variant="outline">Pending</Badge>
                                    <Button
                                        size="sm"
                                        :disabled="approve.isPending.value"
                                        @click="
                                            approve.mutate({
                                                itemId: item.id,
                                                isbn: edition.isbn,
                                            })
                                        "
                                    >
                                        <Spinner
                                            v-if="
                                                isPendingFor(approve, edition.isbn)
                                            "
                                        />
                                        Approve
                                    </Button>
                                </template>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    :disabled="split.isPending.value"
                                    @click="onSplit(edition.isbn)"
                                >
                                    <Spinner
                                        v-if="isPendingFor(split, edition.isbn)"
                                    />
                                    Split off
                                </Button>
                            </template>
                        </EditionItem>
                    </ItemGroup>
                </section>
            </template>
        </template>
    </div>
</template>
