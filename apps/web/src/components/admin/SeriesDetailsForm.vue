<script setup lang="ts">
import { AUDIENCE_GROUPS, AUDIENCE_LABELS, Audience } from '@analog/types';
import GenrePicker from '@/components/admin/GenrePicker.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import FormError from '@/components/FormError.vue';
import { Button } from '@/components/shadcn-components/button';
import { Label } from '@/components/shadcn-components/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/shadcn-components/select';
import { Spinner } from '@/components/shadcn-components/spinner';
import { Textarea } from '@/components/shadcn-components/textarea';
import {
    type AdminSeries,
    useSetSeriesGenres,
    useUpdateAdminSeries,
} from '@/composables/useAdmin';

import { computed, ref, watch } from 'vue';

// A series' description and audience, which save when changed, and genres
// for all its volumes at once.
const props = defineProps<{ series: AdminSeries; volumeCount: number }>();

const NOT_SET = 'none';

const saveSeries = useUpdateAdminSeries();
const applyGenres = useSetSeriesGenres();

function save(changes: { description?: string; audience?: Audience | null }) {
    const { id, title, kind } = props.series;
    saveSeries.mutate({ seriesId: id, title, kind, ...changes });
}

const description = ref(props.series.description ?? '');
watch(
    () => props.series.description,
    (saved) => {
        description.value = saved ?? '';
    }
);

function saveDescription() {
    if (description.value.trim() !== (props.series.description ?? '')) {
        save({ description: description.value });
    }
}

const audience = computed(() => props.series.audience ?? NOT_SET);

function onAudience(value: unknown) {
    save({
        audience:
            Object.values(Audience).find((item) => item === value) ?? null,
    });
}

// Starts with every genre the volumes have.
const genres = ref([...props.series.genres]);
watch(
    () => props.series.genres,
    (saved) => {
        genres.value = [...saved];
    }
);
const confirmingApply = ref(false);

function onApply() {
    applyGenres.mutate(
        { seriesId: props.series.id, genres: genres.value },
        {
            onSettled: () => {
                confirmingApply.value = false;
            },
        }
    );
}

const error = computed(
    () => (saveSeries.error.value ?? applyGenres.error.value)?.message ?? null
);
</script>

<template>
    <section class="grid gap-4">
        <h2 class="flex items-center gap-2 font-semibold">
            Details
            <Spinner v-if="saveSeries.isPending.value" />
        </h2>
        <FormError :message="error" />
        <ConfirmDialog
            v-model:open="confirmingApply"
            :title="`Set genres on all ${volumeCount} volumes?`"
            description="This replaces each volume's genres with these."
            confirm-text="Apply"
            variant="default"
            :pending="applyGenres.isPending.value"
            @confirm="onApply"
        />

        <div class="grid gap-2">
            <Label for="series-description">Description</Label>
            <Textarea
                id="series-description"
                v-model="description"
                class="min-h-28"
                @blur="saveDescription"
            />
        </div>

        <div class="grid gap-2">
            <Label for="series-audience">Audience</Label>
            <Select :model-value="audience" @update:model-value="onAudience">
                <SelectTrigger id="series-audience" class="w-48">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem :value="NOT_SET">Not set</SelectItem>
                    <SelectGroup
                        v-for="group in AUDIENCE_GROUPS"
                        :key="group.label"
                    >
                        <SelectLabel>{{ group.label }}</SelectLabel>
                        <SelectItem
                            v-for="value in group.audiences"
                            :key="value"
                            :value="value"
                        >
                            {{ AUDIENCE_LABELS[value] }}
                        </SelectItem>
                    </SelectGroup>
                </SelectContent>
            </Select>
        </div>

        <div class="grid gap-2">
            <Label>Genres for every volume</Label>
            <GenrePicker v-model="genres" placeholder="Add a genre…" />
            <div>
                <Button
                    variant="outline"
                    :disabled="!volumeCount || applyGenres.isPending.value"
                    @click="confirmingApply = true"
                >
                    <Spinner v-if="applyGenres.isPending.value" />
                    Apply to all volumes
                </Button>
            </div>
        </div>
    </section>
</template>
