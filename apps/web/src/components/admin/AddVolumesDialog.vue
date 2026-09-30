<script setup lang="ts">
import CoverImage from '@/components/CoverImage.vue';
import FormError from '@/components/FormError.vue';
import LoadMore from '@/components/lists/LoadMore.vue';
import SearchInput from '@/components/SearchInput.vue';
import { Alert, AlertDescription } from '@/components/shadcn-components/alert';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { Checkbox } from '@/components/shadcn-components/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/shadcn-components/dialog';
import { Empty, EmptyDescription } from '@/components/shadcn-components/empty';
import { Input } from '@/components/shadcn-components/input';
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemMedia,
    ItemTitle,
} from '@/components/shadcn-components/item';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/shadcn-components/select';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    type NewVolume,
    useAddSeriesVolumes,
    type VolumeProblem,
} from '@/composables/useAdmin';
import {
    GOOGLE_SEARCH_DELAY_MS,
    type GoogleResult,
    useAdminGoogleSearch,
} from '@/composables/useCatalog';
import { useSearchTerm } from '@/composables/useSearchTerm';
import { VolumeField } from '@/lib/catalog-schemas';
import { SEARCH_LANGUAGES } from '@/lib/languages';
import { vNoAutofill } from '@/lib/no-autofill';
import { missingVolumes } from '@/lib/volumes';

import { CheckCircleIcon } from '@lucide/vue';
import { computed, ref } from 'vue';

const ANY_LANGUAGE = 'any';

const props = defineProps<{
    seriesId: string;
    seriesTitle: string;
    // Volume numbers the series already has.
    volumes: number[];
    volumeCount: number | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const query = ref('');
const { term } = useSearchTerm(query, { delayMs: GOOGLE_SEARCH_DELAY_MS });
const language = ref('en');

const results = useAdminGoogleSearch(
    term,
    () => (language.value === ANY_LANGUAGE ? null : language.value),
    open
);

// Later pages repeat books under other ISBNs, so each title shows once.
const rows = computed(() => {
    const seen = new Set<string>();
    return results.items.filter((result) => {
        const key = `${result.title.toLowerCase()}|${result.language}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
});

const selected = ref(new Set<string>());
// Typed volume numbers by ISBN. Rows start with the number in the title.
const typedVolumes = ref<Record<string, string>>({});
const have = computed(() => new Set(props.volumes));

// Up to the total, or the highest number when there's no total.
const missing = computed(() => {
    const total =
        props.volumeCount ?? Math.floor(Math.max(0, ...props.volumes));
    return total ? missingVolumes(props.volumes, total) : null;
});

function volumeText(result: GoogleResult): string {
    return typedVolumes.value[result.isbn] ?? String(result.volume ?? '');
}

function volumeOf(result: GoogleResult): number | null | undefined {
    const parsed = VolumeField.safeParse(volumeText(result));
    return parsed.success ? parsed.data : undefined;
}

function inSeries(result: GoogleResult): boolean {
    const volume = volumeOf(result);
    return volume != null && have.value.has(volume);
}

function toggle(isbn: string, on: boolean | 'indeterminate') {
    if (on === true) {
        selected.value.add(isbn);
    } else {
        selected.value.delete(isbn);
    }
}

const add = useAddSeriesVolumes();
const total = ref(0);
const added = ref<number | null>(null);
const problems = ref<VolumeProblem[]>([]);
const formError = ref<string | null>(null);

async function onAdd() {
    formError.value = null;
    const picked = rows.value.filter((row) => selected.value.has(row.isbn));
    const volumes: NewVolume[] = [];
    for (const row of picked) {
        const volume = volumeOf(row);
        if (volume === undefined) {
            formError.value = `Check the volume number for ${row.title}`;
            return;
        }
        volumes.push({ isbn: row.isbn, title: row.title, volume });
    }
    const last = Number.POSITIVE_INFINITY;
    volumes.sort((a, b) => (a.volume ?? last) - (b.volume ?? last));

    total.value = volumes.length;
    added.value = null;
    problems.value = [];
    try {
        const found = await add.mutateAsync({
            seriesId: props.seriesId,
            volumes,
        });
        problems.value = found;
        added.value = volumes.length - found.length;
        selected.value.clear();
    } catch (err) {
        formError.value = err instanceof Error ? err.message : null;
    }
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-xl">
            <DialogHeader>
                <DialogTitle>Add volumes to {{ seriesTitle }}</DialogTitle>
                <DialogDescription v-if="missing">
                    Missing {{ missing }}
                </DialogDescription>
            </DialogHeader>

            <div class="flex gap-2">
                <SearchInput v-model="query" placeholder="Search titles" />
                <Select v-model="language">
                    <SelectTrigger
                        class="w-auto shrink-0"
                        aria-label="Language"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem :value="ANY_LANGUAGE"
                            >Any language</SelectItem
                        >
                        <SelectItem
                            v-for="option in SEARCH_LANGUAGES"
                            :key="option.code"
                            :value="option.code"
                        >
                            {{ option.name }}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <FormError :message="formError ?? results.error" />
            <Alert v-if="added !== null && !add.isPending.value">
                <CheckCircleIcon />
                <AlertDescription class="grid gap-1">
                    <p>Added {{ added }} of {{ total }}.</p>
                    <p v-for="problem in problems" :key="problem.isbn">
                        <RouterLink
                            v-if="problem.itemId"
                            :to="{
                                name: 'admin-item',
                                params: { id: problem.itemId },
                            }"
                            class="underline"
                        >
                            {{ problem.title }}
                        </RouterLink>
                        <template v-else>{{ problem.title }}</template
                        >:
                        {{ problem.message }}
                    </p>
                </AlertDescription>
            </Alert>

            <div class="max-h-96 overflow-y-auto">
                <div
                    v-if="results.isLoading && !rows.length"
                    class="flex justify-center p-8"
                >
                    <Spinner class="size-6" />
                </div>
                <Empty v-else-if="term && !results.isLoading && !rows.length">
                    <EmptyDescription>Nothing found.</EmptyDescription>
                </Empty>
                <ItemGroup
                    v-else
                    :class="{ 'opacity-60 transition-opacity': results.isLoading }"
                >
                    <Item v-for="result in rows" :key="result.isbn" size="sm">
                        <ItemMedia class="flex items-center gap-3">
                            <Checkbox
                                :aria-label="`Add ${result.title}`"
                                :model-value="selected.has(result.isbn)"
                                :disabled="add.isPending.value"
                                @update:model-value="toggle(result.isbn, $event)"
                            />
                            <CoverImage
                                :src="result.coverUrl"
                                alt=""
                                size="sm"
                                class="h-12 w-8"
                            />
                        </ItemMedia>
                        <ItemContent class="min-w-0">
                            <ItemTitle class="line-clamp-2">
                                {{ result.title }}
                            </ItemTitle>
                            <ItemDescription>
                                {{
                                    [result.author, result.language, result.year]
                                        .filter(Boolean)
                                        .join(' · ')
                                }}
                            </ItemDescription>
                        </ItemContent>
                        <ItemActions class="flex-col items-end gap-1">
                            <Input
                                :model-value="volumeText(result)"
                                type="number"
                                inputmode="decimal"
                                v-no-autofill
                                min="0"
                                step="any"
                                placeholder="Vol."
                                :aria-label="`Volume of ${result.title}`"
                                class="w-20"
                                @update:model-value="
                                    typedVolumes[result.isbn] = String($event)
                                "
                            />
                            <Badge v-if="inSeries(result)" variant="secondary">
                                In series
                            </Badge>
                        </ItemActions>
                    </Item>
                </ItemGroup>
                <LoadMore
                    v-if="rows.length"
                    :has-more="results.hasMore"
                    :loading="results.isLoadingMore"
                    @load="results.loadMore"
                />
            </div>

            <DialogFooter>
                <Button
                    :disabled="!selected.size || add.isPending.value"
                    @click="onAdd"
                >
                    <template v-if="add.isPending.value">
                        <Spinner />
                        Adding {{ Math.min(add.done.value + 1, total) }} of
                        {{ total }}
                    </template>
                    <template v-else>Add {{ selected.size }} selected</template>
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
