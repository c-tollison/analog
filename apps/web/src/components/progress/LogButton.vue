<script setup lang="ts">
import { ProgressStatus } from '@analog/types';
import AddToShelfDialog from '@/components/collections/AddToShelfDialog.vue';
import FormError from '@/components/FormError.vue';
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
}>();

const emit = defineEmits<{ changed: [status: ProgressStatus | null] }>();

const isMenuOpen = ref(false);
const isAddOpen = ref(false);

const { mutate, isPending, variables, error } = useSetProgressStatus();

// Show the picked status while it saves.
const shown = computed(() =>
    isPending.value && variables.value ? variables.value.status : props.status
);

function setStatus(status: ProgressStatus | null) {
    mutate(
        { catalogItemId: props.catalogItemId, status },
        { onSuccess: () => emit('changed', status) }
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
        <ButtonGroup>
            <Button
                :variant="shown ? 'secondary' : 'outline'"
                :disabled="isPending"
                @click="onMain"
            >
                <Spinner v-if="isPending" />
                <CheckIcon v-else-if="shown" />
                <BookmarkPlusIcon v-else />
                {{ labels[shown ?? ProgressStatus.Planned] }}
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

    <AddToShelfDialog
        v-model:open="isAddOpen"
        :catalog-item-id="catalogItemId"
        :title="title"
        :start-shelf-id="shelfId"
    />
</template>
