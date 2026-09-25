<script setup lang="ts">
import { MAX_PAGE_SIZE, MediaFormat } from '@analog/types';
import BackButton from '@/components/BackButton.vue';
import FormError from '@/components/FormError.vue';
import IsbnScanner from '@/components/scan/IsbnScanner.vue';
import { Alert, AlertDescription } from '@/components/shadcn-components/alert';
import { Label } from '@/components/shadcn-components/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/shadcn-components/select';
import { Spinner } from '@/components/shadcn-components/spinner';
import { useCollections } from '@/composables/useCollections';
import { MEDIA_TYPES, type MediaTypeValue } from '@/lib/media-types';

import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const mediaType = ref<MediaTypeValue>(MediaFormat.Book);
const collectionId = ref('');

const collectionsList = useCollections(MAX_PAGE_SIZE);
const collections = computed(() => collectionsList.items);

const formats = computed(
    () => MEDIA_TYPES.find((t) => t.value === mediaType.value)?.formats ?? []
);
const collection = computed(() =>
    collections.value.find((c) => c.id === collectionId.value)
);

const back = computed(() => {
    const from = collections.value.find((c) => c.id === route.query.collection);
    return from
        ? {
              to: { name: 'collection', params: { id: from.id } },
              text: from.name,
          }
        : { to: { name: 'collections' }, text: 'Collections' };
});

function selectCollection(id: string) {
    collectionId.value = id;
}

watch(
    collections,
    (list) => {
        const fromRoute = route.query.collection;
        if (
            !collectionId.value &&
            typeof fromRoute === 'string' &&
            list.some((c) => c.id === fromRoute)
        ) {
            selectCollection(fromRoute);
        }
    },
    { immediate: true }
);
</script>

<template>
    <main class="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
        <div>
            <BackButton :to="back.to" :text="back.text" class="-ml-2" />
        </div>

        <h1 class="text-lg font-semibold">Scan</h1>

        <div class="grid grid-cols-2 gap-2">
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
            <div class="grid gap-1.5">
                <Label for="collection">Add to</Label>
                <Select
                    :model-value="collectionId"
                    :disabled="!collections.length"
                    @update:model-value="
                                (id) => selectCollection(String(id))
                            "
                >
                    <SelectTrigger id="collection" class="w-full">
                        <Spinner v-if="collectionsList.isLoading" />
                        <SelectValue
                            :placeholder="
                                        collectionsList.isLoading
                                            ? 'Loading…'
                                            : 'No collections'
                                    "
                        />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem
                            v-for="c in collections"
                            :key="c.id"
                            :value="c.id"
                        >
                            {{ c.name }}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <FormError :message="collectionsList.error" />
        <Alert
            v-if="
                        !collectionsList.isLoading &&
                        !collectionsList.error &&
                        !collections.length
                    "
        >
            <AlertDescription>
                <span>
                    You need a collection to add items to.
                    <RouterLink class="underline" :to="{ name: 'collections' }">
                        Create one
                    </RouterLink>
                    first.
                </span>
            </AlertDescription>
        </Alert>

        <IsbnScanner :formats="formats" :collection="collection" />
    </main>
</template>
