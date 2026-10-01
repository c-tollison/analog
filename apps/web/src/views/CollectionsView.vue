<script setup lang="ts">
import CollectionRow from '@/components/collections/CollectionRow.vue';
import CreateCollectionDialog from '@/components/collections/CreateCollectionDialog.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import { Button } from '@/components/shadcn-components/button';
import { ItemGroup } from '@/components/shadcn-components/item';
import { Label } from '@/components/shadcn-components/label';
import { Switch } from '@/components/shadcn-components/switch';
import { useCollections } from '@/composables/useCollections';
import { useUpdatePreferences } from '@/composables/useUsers';
import { staggerIn } from '@/lib/motion';
import { useSessionStore } from '@/stores/session';

import { PlusIcon } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';

const isCreateOpen = ref(false);

const collections = useCollections();

const { session } = storeToRefs(useSessionStore());
const preferences = useUpdatePreferences();

// Follows the toggle while the save is in flight.
const showProgress = computed(
    () =>
        (preferences.isPending.value
            ? preferences.variables.value?.showCollectionProgress
            : undefined) ??
        session.value?.user.showCollectionProgress ??
        true
);

function setShowProgress(showCollectionProgress: boolean) {
    preferences.mutate({ showCollectionProgress });
}
</script>

<template>
    <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
            <h1 class="text-lg font-semibold">Collections</h1>
            <Button size="sm" @click="isCreateOpen = true">
                <PlusIcon />
                New collection
            </Button>
        </div>

        <FormError :message="preferences.error.value?.message ?? null" />

        <CreateCollectionDialog v-model:open="isCreateOpen" />

        <div class="flex justify-end">
            <div class="flex items-center gap-2">
                <Switch
                    id="show-progress"
                    :model-value="showProgress"
                    @update:model-value="setShowProgress"
                />
                <Label for="show-progress">Progress</Label>
            </div>
        </div>

        <PagedList
            :list="collections"
            empty-text="No collections yet. Click New collection to make one."
        >
            <template #default="{ items }">
                <ItemGroup class="grid sm:grid-cols-2">
                    <CollectionRow
                        v-for="(c, index) in items"
                        v-bind="staggerIn(index)"
                        :key="c.id"
                        :collection="c"
                        :show-progress="showProgress"
                    />
                </ItemGroup>
            </template>
        </PagedList>
    </div>
</template>
