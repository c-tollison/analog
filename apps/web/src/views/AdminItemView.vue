<script setup lang="ts">
import { MediaFormat } from '@analog/types';
import AdminItemForm from '@/components/admin/AdminItemForm.vue';
import BackButton from '@/components/BackButton.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import MediaDetails from '@/components/media/MediaDetails.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { Separator } from '@/components/shadcn-components/separator';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    useAdminItem,
    useDeleteAdminItem,
    useSetItemVerified,
} from '@/composables/useAdmin';
import { useRefreshBook } from '@/composables/useCatalog';
import { formatDate, timeAgo } from '@/lib/dates';
import { FORMAT_LABELS, SERIES_KIND_LABELS } from '@/lib/media-types';

import { RefreshCwIcon, Trash2Icon } from '@lucide/vue';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps<{ id: string }>();

const router = useRouter();

const { data: item, error: loadError } = useAdminItem(() => props.id);

const setVerified = useSetItemVerified();
const refresh = useRefreshBook();
const remove = useDeleteAdminItem();

const confirmingDelete = ref(false);

const facts = computed(() => {
    if (!item.value) return [];
    const { value } = item;
    const facts = [
        { label: 'ISBN', value: value.barcode },
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
        !!item.value.barcode
);

const error = computed(
    () =>
        (
            loadError.value ??
            setVerified.error.value ??
            refresh.error.value ??
            remove.error.value
        )?.message ?? null
);

function goBack() {
    if (window.history.state?.back) {
        router.back();
    } else {
        router.replace({ name: 'admin' });
    }
}

function onDelete() {
    remove.mutate(props.id, {
        onSuccess: goBack,
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
                                name: 'admin-series',
                                params: { id: item.seriesId },
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
                        <div class="flex flex-wrap items-center gap-2 pt-1">
                            <Badge variant="secondary">
                                {{
                                    item.kind
                                        ? SERIES_KIND_LABELS[item.kind]
                                        : FORMAT_LABELS[item.format]
                                }}
                            </Badge>
                            <Badge v-if="item.verifiedAt">Verified</Badge>
                            <span
                                v-if="item.verifiedAt"
                                class="text-muted-foreground text-xs"
                            >
                                by {{ item.verifiedBy ?? 'a deleted user' }},
                                {{ timeAgo(item.verifiedAt) }}
                            </span>
                        </div>
                    </div>

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
                            @click="confirmingDelete = true"
                        >
                            <Trash2Icon />
                            Delete
                        </Button>
                    </div>

                    <MediaDetails
                        :description="null"
                        :facts="facts"
                        :links="item.links"
                    />
                </div>
            </div>

            <Separator />

            <section class="grid gap-3">
                <h2 class="font-semibold">Edit</h2>
                <AdminItemForm :key="item.id" :item="item" />
            </section>
        </template>
    </div>
</template>
