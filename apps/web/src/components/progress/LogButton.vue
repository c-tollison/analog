<script setup lang="ts">
import { ProgressStatus } from '@analog/types';
import AddToShelfDialog from '@/components/collections/AddToShelfDialog.vue';
import FormError from '@/components/FormError.vue';
import ReviewSheet from '@/components/progress/ReviewSheet.vue';
import { Button } from '@/components/shadcn-components/button';
import { ButtonGroup } from '@/components/shadcn-components/button-group';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/shadcn-components/dropdown-menu';
import { Spinner } from '@/components/shadcn-components/spinner';
import { useSetProgressStatus } from '@/composables/useProgress';
import { PROGRESS_STATUSES, type StatusLabels } from '@/lib/media-types';

import {
    BookmarkPlusIcon,
    CheckIcon,
    ChevronDownIcon,
    LibraryBigIcon,
    XIcon,
} from '@lucide/vue';
import { computed, ref } from 'vue';
import { z } from 'zod';

const props = defineProps<{
    catalogItemId: string;
    title: string;
    status: ProgressStatus | null;
    labels: StatusLabels;
    // The shelf the Add to shelf dialog starts on.
    shelfId?: string | null;
    // Fills its container, like a card in a grid.
    block?: boolean;
}>();

const isMenuOpen = ref(false);
const isAddOpen = ref(false);

const { mutate, isPending, variables, error } = useSetProgressStatus();

// Show the picked status while it saves.
const shown = computed(() =>
    isPending.value && variables.value ? variables.value.status : props.status
);

const isReviewOpen = ref(false);
const saved = ref<{ rating: number | null; review: string | null }>({
    rating: null,
    review: null,
});

// Finishing something asks for a rating, unless there already is one.
function setStatus(status: ProgressStatus | null) {
    mutate(
        { catalogItemId: props.catalogItemId, status },
        {
            onSuccess: ({ rating, review }) => {
                saved.value = { rating, review };
                if (
                    status === ProgressStatus.Completed &&
                    rating === null &&
                    !review
                ) {
                    isReviewOpen.value = true;
                }
            },
        }
    );
}

const StatusSchema = z.enum(ProgressStatus);

function onPick(value: unknown) {
    const parsed = StatusSchema.safeParse(value);
    if (parsed.success) setStatus(parsed.data);
}

// With no status, the main part adds it to the Log. With one, it opens the
// menu to change it.
function onMain() {
    if (shown.value) {
        isMenuOpen.value = true;
    } else {
        setStatus(ProgressStatus.Planned);
    }
}
</script>

<template>
    <FormError :message="error?.message ?? null" />
    <DropdownMenu v-model:open="isMenuOpen">
        <ButtonGroup :class="{ 'w-full': block }">
            <Button
                :variant="shown ? 'secondary' : 'outline'"
                :class="{ 'min-w-0 flex-1': block }"
                :disabled="isPending"
                @click="onMain"
            >
                <Spinner v-if="isPending" />
                <CheckIcon v-else-if="shown" />
                <BookmarkPlusIcon v-else />
                <span class="truncate">
                    {{ labels[shown ?? ProgressStatus.Planned] }}
                </span>
            </Button>
            <DropdownMenuTrigger as-child>
                <Button
                    :variant="shown ? 'secondary' : 'outline'"
                    size="icon"
                    aria-label="More options"
                >
                    <ChevronDownIcon />
                </Button>
            </DropdownMenuTrigger>
        </ButtonGroup>
        <DropdownMenuContent align="end" class="w-48">
            <DropdownMenuLabel>Log</DropdownMenuLabel>
            <DropdownMenuRadioGroup
                :model-value="shown ?? undefined"
                @update:model-value="onPick"
            >
                <DropdownMenuRadioItem
                    v-for="value in PROGRESS_STATUSES"
                    :key="value"
                    :value="value"
                >
                    {{ labels[value] }}
                </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuItem v-if="shown" @select="setStatus(null)">
                <XIcon />
                Remove from Log
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="isAddOpen = true">
                <LibraryBigIcon />
                Add to shelf…
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>

    <ReviewSheet
        v-model:open="isReviewOpen"
        :catalog-item-id="catalogItemId"
        :title="title"
        :rating="saved.rating"
        :review="saved.review"
    />

    <AddToShelfDialog
        v-model:open="isAddOpen"
        :catalog-item-id="catalogItemId"
        :title="title"
        :start-shelf-id="shelfId"
    />
</template>
