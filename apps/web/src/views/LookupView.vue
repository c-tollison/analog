<script setup lang="ts">
import { MediaFormat } from '@analog/types';
import BackButton from '@/components/BackButton.vue';
import FormError from '@/components/FormError.vue';
import IsbnScanner from '@/components/scan/IsbnScanner.vue';
import { Label } from '@/components/shadcn-components/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/shadcn-components/select';
import { Spinner } from '@/components/shadcn-components/spinner';
import { useCollection } from '@/composables/useCollections';
import { MEDIA_TYPES, type MediaTypeValue } from '@/lib/media-types';

import { computed, ref } from 'vue';

const props = defineProps<{ collectionId: string }>();

const { data: collection, error: loadError } = useCollection(
    () => props.collectionId
);

const mediaType = ref<MediaTypeValue>(MediaFormat.Book);
const formats = computed(
    () => MEDIA_TYPES.find((t) => t.value === mediaType.value)?.formats ?? []
);
</script>

<template>
    <div class="mx-auto flex w-full max-w-lg flex-col gap-4">
        <div>
            <BackButton
                :to="{ name: 'collection', params: { id: collectionId } }"
                :text="collection?.name ?? 'Collection'"
                class="-ml-2"
            />
        </div>

        <h1 v-if="collection" class="text-lg font-semibold">
            Add to {{ collection.name }}
        </h1>
        <Spinner v-else-if="!loadError" />
        <FormError :message="loadError?.message ?? null" />

        <IsbnScanner
            v-if="collection"
            :formats="formats"
            :collection="collection"
        >
            <div class="grid gap-1.5">
                <Label for="media-type">Type</Label>
                <Select v-model="mediaType">
                    <SelectTrigger id="media-type" class="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem
                            v-for="type in MEDIA_TYPES"
                            :key="type.value"
                            :value="type.value"
                        >
                            {{ type.label }}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </IsbnScanner>
    </div>
</template>
