<script setup lang="ts">
import { DETAILS_SOURCE_INFO, detailsSourceFor } from '@analog/types';
import AdminSeriesForm from '@/components/admin/AdminSeriesForm.vue';
import MergeSeriesDialog from '@/components/admin/MergeSeriesDialog.vue';
import SeriesItemsForm from '@/components/admin/SeriesItemsForm.vue';
import VerifiedBy from '@/components/admin/VerifiedBy.vue';
import BackButton from '@/components/BackButton.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import ExternalLinks from '@/components/media/ExternalLinks.vue';
import LinkDetailsSourceDialog from '@/components/series/LinkDetailsSourceDialog.vue';
import VolumeCountDialog from '@/components/series/VolumeCountDialog.vue';
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/shadcn-components/alert';
import { Button } from '@/components/shadcn-components/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/shadcn-components/popover';
import { Separator } from '@/components/shadcn-components/separator';
import { Spinner } from '@/components/shadcn-components/spinner';
import WithTooltip from '@/components/WithTooltip.vue';
import {
    useAdminSeries,
    useAdminSeriesItems,
    useDeleteAdminSeries,
    useSetSeriesVerified,
} from '@/composables/useAdmin';
import { goBackOr } from '@/lib/navigation';

import {
    CopyIcon,
    InfoIcon,
    LinkIcon,
    MergeIcon,
    PencilIcon,
    Trash2Icon,
} from '@lucide/vue';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps<{ id: string }>();

const router = useRouter();

const { data: series, error: seriesError } = useAdminSeries(() => props.id);
const { data: items, error: itemsError } = useAdminSeriesItems(() => props.id);

const setVerified = useSetSeriesVerified();
const remove = useDeleteAdminSeries();

const isLinkOpen = ref(false);
const isVolumeCountOpen = ref(false);
const isMergeOpen = ref(false);
// The series to merge into, when picked from the duplicate warning.
const mergeInto = ref<{ id: string; title: string } | null>(null);

function openMerge(into: { id: string; title: string } | null) {
    mergeInto.value = into;
    isMergeOpen.value = true;
}
const confirmingDelete = ref(false);

// Where this kind of series can get more details, e.g. AniList for manga.
const linkSource = computed(() =>
    series.value ? detailsSourceFor(series.value.kind) : null
);

// Rebuild the items form when items join or leave the series.
const itemsKey = computed(
    () => items.value?.map((item) => item.id).join() ?? ''
);

const error = computed(
    () =>
        (
            seriesError.value ??
            itemsError.value ??
            setVerified.error.value ??
            remove.error.value
        )?.message ?? null
);

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

        <div v-if="!series && !seriesError" class="flex justify-center p-8">
            <Spinner class="size-6" />
        </div>

        <template v-if="series">
            <ConfirmDialog
                v-model:open="confirmingDelete"
                :title="`Delete ${series.title}?`"
                confirm-text="Delete"
                :pending="remove.isPending.value"
                @confirm="onDelete"
            />
            <MergeSeriesDialog
                v-model:open="isMergeOpen"
                :series-id="series.id"
                :series-title="series.title"
                :into="mergeInto"
            />
            <VolumeCountDialog
                v-model:open="isVolumeCountOpen"
                :series-id="series.id"
                :volume-count="series.volumeCount"
            />
            <LinkDetailsSourceDialog
                v-if="linkSource"
                v-model:open="isLinkOpen"
                :series-id="series.id"
                :series-title="series.title"
                :source="linkSource"
                :linked-id="series.detailsId"
                :linked-title="series.detailsTitle"
                :volume-count="series.volumeCount"
            />

            <Alert v-if="series.sameTitle.length">
                <CopyIcon />
                <AlertTitle> Another series has this name </AlertTitle>
                <AlertDescription class="grid gap-2">
                    <div
                        v-for="other in series.sameTitle"
                        :key="other.id"
                        class="flex flex-wrap items-center gap-2"
                    >
                        <RouterLink
                            :to="{
                                name: 'admin-series',
                                params: { id: other.id },
                            }"
                            class="underline"
                        >
                            {{ other.title }}
                        </RouterLink>
                        <Button
                            variant="outline"
                            size="sm"
                            @click="openMerge(other)"
                        >
                            <MergeIcon />
                            Merge into this
                        </Button>
                    </div>
                </AlertDescription>
            </Alert>

            <div class="flex gap-4">
                <CoverImage
                    size="md"
                    :src="series.coverUrl"
                    :alt="series.title"
                    class="h-24 w-16 shrink-0 sm:h-36 sm:w-24"
                />
                <div class="grid min-w-0 flex-1 content-start gap-4">
                    <AdminSeriesForm :key="series.id" :series="series" />

                    <div class="grid gap-2">
                        <div class="flex flex-wrap gap-2">
                            <Button
                                :variant="
                                    series.verifiedAt ? 'outline' : 'default'
                                "
                                :disabled="setVerified.isPending.value"
                                @click="
                                    setVerified.mutate({
                                        seriesId: series.id,
                                        verified: !series.verifiedAt,
                                    })
                                "
                            >
                                <Spinner v-if="setVerified.isPending.value" />
                                {{ series.verifiedAt ? 'Unverify' : 'Verify' }}
                            </Button>
                            <Button variant="outline" @click="openMerge(null)">
                                <MergeIcon />
                                Merge into…
                            </Button>
                            <div class="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    :disabled="!items || items.length > 0"
                                    @click="confirmingDelete = true"
                                >
                                    <Trash2Icon />
                                    Delete
                                </Button>
                                <Popover v-if="items?.length">
                                    <WithTooltip label="Why can't I delete it?">
                                        <PopoverTrigger as-child>
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                aria-label="Why can't I delete it?"
                                            >
                                                <InfoIcon />
                                            </Button>
                                        </PopoverTrigger>
                                    </WithTooltip>
                                    <PopoverContent class="w-64 text-sm">
                                        Move or merge its items before deleting
                                        it.
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <VerifiedBy
                            v-if="series.verifiedAt"
                            :verified-at="series.verifiedAt"
                            :verified-by="series.verifiedBy"
                        />
                    </div>

                    <Separator />

                    <dl
                        class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 text-sm"
                    >
                        <dt class="text-muted-foreground">Volumes</dt>
                        <dd class="flex items-center gap-1">
                            <template v-if="series.volumeCount">
                                {{ items?.length ?? 0 }} of
                                {{ series.volumeCount }}
                            </template>
                            <template v-else>
                                {{ items?.length ?? 0 }}
                            </template>
                            <WithTooltip label="Edit total volumes">
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label="Edit total volumes"
                                    @click="isVolumeCountOpen = true"
                                >
                                    <PencilIcon />
                                </Button>
                            </WithTooltip>
                        </dd>
                        <template v-if="linkSource">
                            <dt class="text-muted-foreground">Data source</dt>
                            <dd class="flex flex-wrap items-center gap-2">
                                <template v-if="series.detailsSource">
                                    <ExternalLinks :links="series.links" />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        @click="isLinkOpen = true"
                                    >
                                        <PencilIcon />
                                        Edit link
                                    </Button>
                                </template>
                                <Button
                                    v-else
                                    variant="outline"
                                    size="sm"
                                    @click="isLinkOpen = true"
                                >
                                    <LinkIcon />
                                    Link
                                    {{ DETAILS_SOURCE_INFO[linkSource].label }}
                                </Button>
                            </dd>
                        </template>
                    </dl>
                </div>
            </div>

            <Separator />

            <section class="grid gap-3">
                <h2 class="font-semibold">Volumes</h2>
                <div
                    v-if="!items && !itemsError"
                    class="flex justify-center p-4"
                >
                    <Spinner class="size-6" />
                </div>
                <SeriesItemsForm
                    v-else-if="items"
                    :key="itemsKey"
                    :series-id="series.id"
                    :series-title="series.title"
                    :volume-count="series.volumeCount"
                    :items="items"
                />
            </section>
        </template>
    </div>
</template>
