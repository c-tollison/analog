<script setup lang="ts">
import BackButton from '@/components/BackButton.vue';
import FormError from '@/components/FormError.vue';
import IsbnScanner from '@/components/scan/IsbnScanner.vue';
import { Spinner } from '@/components/shadcn-components/spinner';
import { useCollection } from '@/composables/useCollections';
import { BOOK_BARCODES } from '@/lib/book-labels';

const props = defineProps<{ id: string }>();

const { data: collection, error: loadError } = useCollection(() => props.id);
</script>

<template>
    <div class="mx-auto flex w-full max-w-lg flex-col gap-4">
        <div>
            <BackButton
                :to="{ name: 'collection', params: { id } }"
                :text="collection?.name ?? 'Shelf'"
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
            :formats="BOOK_BARCODES"
            :collection="collection"
        />
    </div>
</template>
