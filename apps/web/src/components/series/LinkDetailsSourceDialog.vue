<script setup lang="ts">
import type { DetailsSource } from '@analog/types';
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import SearchInput from '@/components/SearchInput.vue';
import { Button } from '@/components/shadcn-components/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/shadcn-components/dialog';
import { Empty, EmptyDescription } from '@/components/shadcn-components/empty';
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/shadcn-components/form';
import { Input } from '@/components/shadcn-components/input';
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemMedia,
    ItemTitle,
} from '@/components/shadcn-components/item';
import { Spinner } from '@/components/shadcn-components/spinner';
import { useAppForm } from '@/composables/useAppForm';
import { useSearchTerm } from '@/composables/useSearchTerm';
import {
    useDetailsSearch,
    useLinkDetailsSource,
    useUnlinkDetailsSource,
} from '@/composables/useSeries';
import { LinkDetailsSourceFormSchema } from '@/lib/catalog-schemas';
import { DETAILS_SOURCE_LABELS } from '@/lib/media-types';
import { vNoAutofill } from '@/lib/no-autofill';

import { computed, ref, watch } from 'vue';

const props = defineProps<{
    seriesId: string;
    seriesTitle: string;
    source: DetailsSource;
    // The current link, if the series has one.
    linkedId: string | null;
    linkedTitle: string | null;
    volumeCount: number | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const sourceLabel = computed(() => DETAILS_SOURCE_LABELS[props.source]);

// "Haikyu!! (English)" searches better as "Haikyu!!".
function searchText(title: string): string {
    return title.replace(/\s*\([^)]*\)/g, '').trim() || title;
}

const query = ref(searchText(props.seriesTitle));
const { term } = useSearchTerm(query);
const {
    data: results,
    isFetching,
    error,
} = useDetailsSearch(() => props.source, term);

const pickedTitle = ref(props.linkedTitle);

const link = useLinkDetailsSource();
const unlink = useUnlinkDetailsSource();

const {
    submit,
    formError,
    isSubmitting,
    fieldProps,
    values,
    setFieldValue,
    resetForm,
} = useAppForm({
    schema: LinkDetailsSourceFormSchema,
    initialValues: {
        sourceId: props.linkedId,
        volumeCount: props.volumeCount ?? '',
    },
    onSubmit: async ({ sourceId, volumeCount }) => {
        if (sourceId === null) return 'Pick a match';
        await link.mutateAsync({
            seriesId: props.seriesId,
            source: props.source,
            sourceId,
            volumeCount,
        });
        open.value = false;
        return undefined;
    },
});

function pick(result: { id: string; title: string; volumes: number | null }) {
    setFieldValue('sourceId', result.id);
    setFieldValue('volumeCount', result.volumes ?? '');
    pickedTitle.value = result.title;
}

function onUnlink() {
    unlink.mutate(props.seriesId, {
        onSuccess: () => {
            open.value = false;
        },
    });
}

watch(open, (isOpen) => {
    if (!isOpen) return;
    query.value = searchText(props.seriesTitle);
    pickedTitle.value = props.linkedTitle;
    unlink.reset();
    resetForm({
        values: {
            sourceId: props.linkedId,
            volumeCount: props.volumeCount ?? '',
        },
    });
});

function describe(result: {
    format: string | null;
    volumes: number | null;
    startYear: number | null;
}): string {
    return [
        result.format,
        result.volumes
            ? `${result.volumes} ${result.volumes === 1 ? 'volume' : 'volumes'}`
            : null,
        result.startYear,
    ]
        .filter(Boolean)
        .join(' · ');
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="flex max-h-[85svh] flex-col sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Link to {{ sourceLabel }}</DialogTitle>
            </DialogHeader>

            <form class="grid min-h-0 flex-1 gap-4" novalidate @submit="submit">
                <FormError
                    :message="formError ?? unlink.error.value?.message ?? null"
                />
                <SearchInput
                    v-model="query"
                    :placeholder="`Search ${sourceLabel}`"
                />

                <div class="min-h-0 overflow-y-auto">
                    <FormError :message="error?.message ?? null" />
                    <div
                        v-if="isFetching && !results"
                        class="flex justify-center p-4"
                    >
                        <Spinner class="size-6" />
                    </div>
                    <Empty v-else-if="results && !results.length">
                        <EmptyDescription>No matches.</EmptyDescription>
                    </Empty>
                    <ItemGroup v-else-if="results" class="gap-1">
                        <Item
                            v-for="result in results"
                            :key="result.id"
                            as="button"
                            type="button"
                            size="sm"
                            :variant="
                                values.sourceId === result.id
                                    ? 'outline'
                                    : 'default'
                            "
                            :aria-pressed="values.sourceId === result.id"
                            class="hover:bg-muted text-left"
                            @click="pick(result)"
                        >
                            <ItemMedia>
                                <CoverImage
                                    size="sm"
                                    :src="result.coverUrl"
                                    :alt="result.title"
                                    class="aspect-2/3 w-8"
                                />
                            </ItemMedia>
                            <ItemContent class="min-w-0">
                                <ItemTitle class="line-clamp-2">
                                    {{ result.title }}
                                </ItemTitle>
                                <ItemDescription>
                                    {{ describe(result) }}
                                </ItemDescription>
                            </ItemContent>
                        </Item>
                    </ItemGroup>
                </div>

                <FormField name="sourceId">
                    <FormItem>
                        <p v-if="pickedTitle" class="text-sm">
                            Linking to
                            <span class="font-medium">{{ pickedTitle }}</span>
                        </p>
                        <FormMessage />
                    </FormItem>
                </FormField>

                <FormField
                    v-slot="{ componentField }"
                    v-bind="fieldProps"
                    name="volumeCount"
                >
                    <FormItem class="w-32">
                        <FormLabel>Total volumes</FormLabel>
                        <FormControl>
                            <Input
                                type="number"
                                inputmode="numeric"
                                v-no-autofill
                                min="1"
                                step="1"
                                v-bind="componentField"
                            />
                        </FormControl>
                        <FormDescription class="w-72">
                            Omnibus editions have fewer volumes than the
                            original.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                </FormField>

                <DialogFooter>
                    <Button
                        v-if="linkedId !== null"
                        type="button"
                        variant="destructive"
                        :disabled="isSubmitting || unlink.isPending.value"
                        @click="onUnlink"
                    >
                        <Spinner v-if="unlink.isPending.value" />
                        Unlink
                    </Button>
                    <Button
                        type="submit"
                        :disabled="isSubmitting || unlink.isPending.value"
                    >
                        <Spinner v-if="isSubmitting" />
                        Save
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</template>
