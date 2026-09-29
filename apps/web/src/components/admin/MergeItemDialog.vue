<script setup lang="ts">
import { AddedSort, VerifiedFilter } from '@analog/types';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import SearchInput from '@/components/SearchInput.vue';
import { Button } from '@/components/shadcn-components/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/shadcn-components/dialog';
import { Empty, EmptyDescription } from '@/components/shadcn-components/empty';
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemMedia,
    ItemTitle,
} from '@/components/shadcn-components/item';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    adminListQuery,
    useAdminItems,
    useMergeItem,
} from '@/composables/useAdmin';
import { useSearchTerm } from '@/composables/useSearchTerm';

import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps<{ itemId: string; itemTitle: string }>();

const open = defineModel<boolean>('open', { required: true });

const router = useRouter();
const merge = useMergeItem();

const search = ref('');
const { term } = useSearchTerm(search);
const picked = ref<string | null>(null);

const results = useAdminItems(() =>
    adminListQuery(
        { q: term.value, status: VerifiedFilter.All, sort: AddedSort.Newest },
        1
    )
);
// This item can't be merged into itself.
const options = computed(
    () => results.data.value?.items.filter((i) => i.id !== props.itemId) ?? []
);

function onMerge() {
    const intoItemId = picked.value;
    if (!intoItemId) return;
    merge.mutate(
        { itemId: props.itemId, intoItemId },
        {
            onSuccess: () => {
                open.value = false;
                router.replace({
                    name: 'admin-item',
                    params: { id: intoItemId },
                });
            },
        }
    );
}

watch(open, (isOpen) => {
    if (isOpen) {
        search.value = props.itemTitle;
        picked.value = null;
        merge.reset();
    }
});
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="flex max-h-[85svh] flex-col sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Merge {{ itemTitle }}</DialogTitle>
                <DialogDescription>
                    Its ISBNs, collection entries and reviews move to the item
                    you pick, and this item is deleted. The item you pick keeps
                    its own title, cover, series and volume.
                </DialogDescription>
            </DialogHeader>
            <FormError :message="merge.error.value?.message ?? null" />
            <SearchInput v-model="search" placeholder="Search media" />
            <div class="min-h-0 overflow-y-auto">
                <div
                    v-if="results.isLoading.value"
                    class="flex justify-center p-6"
                >
                    <Spinner class="size-6" />
                </div>
                <Empty v-else-if="!options.length">
                    <EmptyDescription>No matches.</EmptyDescription>
                </Empty>
                <ItemGroup v-else class="gap-1">
                    <Item
                        v-for="option in options"
                        :key="option.id"
                        as="button"
                        type="button"
                        size="sm"
                        :variant="picked === option.id ? 'outline' : 'default'"
                        :aria-pressed="picked === option.id"
                        @click="picked = option.id"
                    >
                        <ItemMedia>
                            <CoverImage
                                size="sm"
                                :src="option.coverUrl"
                                :alt="option.title"
                                class="aspect-2/3 w-8"
                            />
                        </ItemMedia>
                        <ItemContent class="min-w-0">
                            <ItemTitle class="line-clamp-2">
                                {{ option.title }}
                            </ItemTitle>
                            <ItemDescription v-if="option.seriesTitle">
                                {{ option.seriesTitle }}
                                <template v-if="option.position !== null">
                                    · Vol. {{ option.position }}
                                </template>
                            </ItemDescription>
                        </ItemContent>
                    </Item>
                </ItemGroup>
            </div>
            <DialogFooter>
                <Button
                    variant="destructive"
                    :disabled="!picked || merge.isPending.value"
                    @click="onMerge"
                >
                    <Spinner v-if="merge.isPending.value" />
                    Merge
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
