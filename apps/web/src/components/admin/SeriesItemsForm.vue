<script setup lang="ts">
import { CheckRule } from '@analog/types';
import ChangeSeriesDialog from '@/components/admin/ChangeSeriesDialog.vue';
import CheckHint from '@/components/admin/CheckHint.vue';
import TitleInput from '@/components/admin/TitleInput.vue';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import SaveButton from '@/components/SaveButton.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { Empty, EmptyDescription } from '@/components/shadcn-components/empty';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/shadcn-components/form';
import { Input } from '@/components/shadcn-components/input';
import {
    Item,
    ItemContent,
    ItemGroup,
    ItemMedia,
} from '@/components/shadcn-components/item';
import WithTooltip from '@/components/WithTooltip.vue';
import {
    type AdminCheck,
    type AdminSeriesItem,
    useAcceptCheck,
    useDismissCheck,
    useSetSeriesItems,
} from '@/composables/useAdmin';
import { useAppForm } from '@/composables/useAppForm';
import { SeriesItemsFormSchema } from '@/lib/admin-schemas';
import { vNoAutofill } from '@/lib/no-autofill';
import { missingVolumes } from '@/lib/volumes';

import {
    ArrowRightLeftIcon,
    ArrowUpRightIcon,
    CheckIcon,
    SparklesIcon,
} from '@lucide/vue';
import { computed, ref } from 'vue';
import type { z } from 'zod';

const props = defineProps<{
    seriesId: string;
    seriesTitle: string;
    volumeCount: number | null;
    items: AdminSeriesItem[];
    // Suggestions `pnpm catalog:check` left on the items.
    checks: AdminCheck[];
}>();

const setItems = useSetSeriesItems();

// The item whose series is being changed.
const moving = ref<AdminSeriesItem | null>(null);
const isMoveOpen = ref(false);

function openMove(item: AdminSeriesItem) {
    moving.value = item;
    isMoveOpen.value = true;
}
const saved = ref(false);

const { submit, formError, isSubmitting, fieldProps, values, setFieldValue } =
    useAppForm({
        schema: SeriesItemsFormSchema,
        initialValues: {
            items: props.items.map((item) => ({
                id: item.id,
                title: item.title,
                volume: item.position ?? '',
            })),
        },
        onSubmit: async ({ items }) => {
            saved.value = false;
            const stored = new Map(props.items.map((item) => [item.id, item]));
            const changed = items.filter((item) => {
                const before = stored.get(item.id);
                return (
                    !before ||
                    before.title !== item.title ||
                    before.position !== item.volume
                );
            });
            if (changed.length) {
                await setItems.mutateAsync({
                    seriesId: props.seriesId,
                    items: changed,
                });
            }
            saved.value = true;
            return undefined;
        },
    });

// What's typed so far, as numbers. Empty or invalid is null.
const typed = computed(() =>
    (values.items ?? []).map(({ volume }) => {
        if (volume === '' || volume == null) return null;
        const number = Number(volume);
        return Number.isFinite(number) ? number : null;
    })
);

const counts = computed(() => {
    const counts = new Map<number, number>();
    for (const volume of typed.value) {
        if (volume !== null) counts.set(volume, (counts.get(volume) ?? 0) + 1);
    }
    return counts;
});

function problem(index: number): string | null {
    const volume = typed.value[index];
    if (volume === null || volume === undefined) return null;
    if ((counts.value.get(volume) ?? 0) > 1) return 'Duplicate';
    if (props.volumeCount !== null && volume > props.volumeCount) {
        return 'Above total';
    }
    return null;
}

// Up to the total, or the highest number when there's no total.
const missing = computed(() => {
    const numbers = typed.value.filter((v): v is number => v !== null);
    const total = props.volumeCount ?? Math.floor(Math.max(0, ...numbers));
    return total ? missingVolumes(numbers, total) : null;
});

// Title and volume suggestions fill the form, so they're saved with the
// rest. Others are accepted or dismissed on their own.
const FORM_RULES = [CheckRule.TitleStyle, CheckRule.VolumeMismatch];

function checksFor(itemId: string) {
    return props.checks.filter((check) => check.catalogItemId === itemId);
}

function isUsed(index: number, check: AdminCheck): boolean {
    const row = values.items?.[index];
    if (!row || check.fix === null) return false;
    return check.rule === CheckRule.TitleStyle
        ? row.title === check.fix
        : String(row.volume) === check.fix;
}

type Row = z.input<typeof SeriesItemsFormSchema>['items'][number];

function withFix(row: Row, check: AdminCheck): Row {
    if (check.fix === null) return row;
    return check.rule === CheckRule.TitleStyle
        ? { ...row, title: check.fix }
        : { ...row, volume: Number(check.fix) };
}

function useFix(index: number, check: AdminCheck) {
    setFieldValue(
        'items',
        (values.items ?? []).map((row, i) =>
            i === index ? withFix(row, check) : row
        )
    );
}

// Every form suggestion not filled in yet, by row.
const unused = computed(() =>
    props.items.flatMap((item, index) =>
        checksFor(item.id)
            .filter((check) => FORM_RULES.includes(check.rule))
            .filter((check) => !isUsed(index, check))
            .map((check) => ({ index, check }))
    )
);

function useAll() {
    const rows = [...(values.items ?? [])];
    for (const { index, check } of unused.value) {
        const row = rows[index];
        if (row) rows[index] = withFix(row, check);
    }
    setFieldValue('items', rows);
}

const accept = useAcceptCheck();
const dismiss = useDismissCheck();
const checkBusy = computed(
    () => accept.isPending.value || dismiss.isPending.value
);

function pendingFor(check: AdminCheck) {
    if (accept.isPending.value && accept.variables.value === check.id) {
        return 'accept';
    }
    if (dismiss.isPending.value && dismiss.variables.value === check.id) {
        return 'dismiss';
    }
    return null;
}

const checkError = computed(
    () => accept.error.value?.message ?? dismiss.error.value?.message ?? null
);
</script>

<template>
    <form class="grid gap-3" novalidate @submit="submit">
        <FormError :message="formError ?? checkError" />
        <div
            v-if="missing || unused.length"
            class="flex flex-wrap items-center justify-between gap-2"
        >
            <p class="text-muted-foreground text-sm">
                <template v-if="missing">Missing {{ missing }}</template>
            </p>
            <Button
                v-if="unused.length"
                type="button"
                variant="outline"
                size="sm"
                @click="useAll"
            >
                <SparklesIcon />
                Use all suggestions ({{ unused.length }})
            </Button>
        </div>
        <Empty v-if="!items.length">
            <EmptyDescription>Nothing in this series.</EmptyDescription>
        </Empty>
        <ItemGroup v-else class="gap-2">
            <Item
                v-for="(item, index) in items"
                :key="item.id"
                :variant="item.verifiedAt ? 'success' : 'outline'"
                size="sm"
                class="flex-nowrap items-start"
            >
                <ItemMedia>
                    <CoverImage
                        size="sm"
                        :src="item.coverUrl"
                        alt=""
                        class="h-12 w-8"
                    />
                </ItemMedia>
                <ItemContent class="min-w-0 gap-2">
                    <div class="flex flex-col gap-2 md:flex-row md:items-start">
                        <div class="flex flex-1 items-start gap-1">
                            <FormField
                                v-slot="{ componentField }"
                                v-bind="fieldProps"
                                :name="`items[${index}].title`"
                            >
                                <FormItem class="flex-1">
                                    <FormControl>
                                        <TitleInput
                                            :aria-label="`Title of ${item.title}`"
                                            v-bind="componentField"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            </FormField>
                            <WithTooltip label="Change series">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Change series"
                                    @click="openMove(item)"
                                >
                                    <ArrowRightLeftIcon />
                                </Button>
                            </WithTooltip>
                            <WithTooltip label="Open book page">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    as-child
                                    aria-label="Open book page"
                                >
                                    <RouterLink
                                        :to="{
                                        name: 'admin-item',
                                        params: { id: item.id },
                                    }"
                                    >
                                        <ArrowUpRightIcon />
                                    </RouterLink>
                                </Button>
                            </WithTooltip>
                        </div>
                        <div
                            class="flex flex-wrap items-center gap-x-4 gap-y-2"
                        >
                            <FormField
                                v-slot="{ componentField }"
                                v-bind="fieldProps"
                                :name="`items[${index}].volume`"
                            >
                                <FormItem class="flex items-center gap-2">
                                    <FormLabel>Vol.</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            inputmode="decimal"
                                            v-no-autofill
                                            min="0"
                                            step="any"
                                            class="w-20"
                                            v-bind="componentField"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            </FormField>
                            <Badge v-if="item.verifiedAt" variant="success">
                                <CheckIcon />
                                Verified
                            </Badge>
                            <Badge
                                v-if="problem(index)"
                                :variant="
                                problem(index) === 'Duplicate'
                                    ? 'destructive'
                                    : 'outline'
                            "
                            >
                                {{ problem(index) }}
                            </Badge>
                        </div>
                    </div>
                    <CheckHint
                        v-for="check in checksFor(item.id)"
                        :key="check.id"
                        :check="check"
                        :disabled="checkBusy"
                        :pending="pendingFor(check)"
                        :fillable="FORM_RULES.includes(check.rule)"
                        :used="isUsed(index, check)"
                        @use="useFix(index, check)"
                        @accept="accept.mutate(check.id)"
                        @dismiss="dismiss.mutate(check.id)"
                    />
                </ItemContent>
            </Item>
        </ItemGroup>
        <SaveButton
            v-if="items.length"
            :pending="isSubmitting"
            :saved="saved"
        />
    </form>
    <ChangeSeriesDialog
        v-if="moving"
        v-model:open="isMoveOpen"
        :item="moving"
        :series="{ id: seriesId, title: seriesTitle }"
    />
</template>
