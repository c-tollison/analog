<script setup lang="ts">
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import SaveButton from '@/components/SaveButton.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { Checkbox } from '@/components/shadcn-components/checkbox';
import {
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from '@/components/shadcn-components/form';
import { Input } from '@/components/shadcn-components/input';
import {
    Table,
    TableBody,
    TableCell,
    TableEmpty,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/shadcn-components/table';
import {
    type AdminSeriesItem,
    useSetSeriesItems,
} from '@/composables/useAdmin';
import { useAppForm } from '@/composables/useAppForm';
import { SeriesItemsFormSchema } from '@/lib/admin-schemas';
import { vNoAutofill } from '@/lib/no-autofill';
import { missingVolumes } from '@/lib/volumes';

import { ArrowUpRightIcon } from '@lucide/vue';
import { computed, ref } from 'vue';

const props = defineProps<{
    seriesId: string;
    volumeCount: number | null;
    items: AdminSeriesItem[];
}>();

const setItems = useSetSeriesItems();
const saved = ref(false);

const { submit, formError, isSubmitting, fieldProps, values, setFieldValue } =
    useAppForm({
        schema: SeriesItemsFormSchema,
        initialValues: {
            items: props.items.map((item) => ({
                id: item.id,
                title: item.title,
                volume: item.position ?? '',
                verified: item.verifiedAt !== null,
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
                    before.position !== item.volume ||
                    (before.verifiedAt !== null) !== item.verified
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

const allVerified = computed(() => {
    const rows = values.items ?? [];
    const count = rows.filter((row) => row.verified).length;
    if (count === 0) return false;
    return count === rows.length ? true : 'indeterminate';
});

function setVerified(index: number, checked: boolean | 'indeterminate') {
    setFieldValue(
        'items',
        (values.items ?? []).map((row, i) =>
            i === index ? { ...row, verified: checked === true } : row
        )
    );
}

function setAllVerified(checked: boolean | 'indeterminate') {
    setFieldValue(
        'items',
        (values.items ?? []).map((row) => ({
            ...row,
            verified: checked === true,
        }))
    );
}
</script>

<template>
    <form class="grid gap-3" novalidate @submit="submit">
        <FormError :message="formError" />
        <p v-if="missing" class="text-muted-foreground text-sm">
            Missing {{ missing }}
        </p>
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead class="w-12" />
                    <TableHead>Title</TableHead>
                    <TableHead class="w-28">Volume</TableHead>
                    <TableHead class="w-24">
                        <div class="flex items-center gap-2">
                            <Checkbox
                                :model-value="allVerified"
                                aria-label="Verify all"
                                @update:model-value="setAllVerified"
                            />
                            Verified
                        </div>
                    </TableHead>
                    <TableHead class="w-28" />
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow v-for="(item, index) in items" :key="item.id">
                    <TableCell>
                        <CoverImage
                            size="sm"
                            :src="item.coverUrl"
                            alt=""
                            class="h-12 w-8"
                        />
                    </TableCell>
                    <TableCell>
                        <div class="flex items-start gap-1">
                            <FormField
                                v-slot="{ componentField }"
                                v-bind="fieldProps"
                                :name="`items[${index}].title`"
                            >
                                <FormItem class="flex-1">
                                    <FormControl>
                                        <Input
                                            v-no-autofill
                                            :aria-label="`Title of ${item.title}`"
                                            v-bind="componentField"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            </FormField>
                            <Button
                                variant="ghost"
                                size="icon"
                                as-child
                                aria-label="Open media page"
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
                        </div>
                    </TableCell>
                    <TableCell>
                        <FormField
                            v-slot="{ componentField }"
                            v-bind="fieldProps"
                            :name="`items[${index}].volume`"
                        >
                            <FormItem>
                                <FormControl>
                                    <Input
                                        type="number"
                                        inputmode="decimal"
                                        v-no-autofill
                                        min="0"
                                        step="any"
                                        :aria-label="`Volume of ${item.title}`"
                                        v-bind="componentField"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        </FormField>
                    </TableCell>
                    <TableCell>
                        <FormField
                            v-slot="{ value }"
                            :name="`items[${index}].verified`"
                            type="checkbox"
                        >
                            <FormItem>
                                <FormControl>
                                    <Checkbox
                                        :model-value="value"
                                        :aria-label="`Verify ${item.title}`"
                                        @update:model-value="
                                            (checked) =>
                                                setVerified(index, checked)
                                        "
                                    />
                                </FormControl>
                            </FormItem>
                        </FormField>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                </TableRow>
                <TableEmpty v-if="!items.length" :colspan="5">
                    Nothing in this series.
                </TableEmpty>
            </TableBody>
        </Table>
        <SaveButton
            v-if="items.length"
            :pending="isSubmitting"
            :saved="saved"
        />
    </form>
</template>
