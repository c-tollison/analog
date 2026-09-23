<script setup lang="ts">
import { CollectionRole } from '@analog/types';
import CoverImage from '@/components/CoverImage.vue';
import AddFromCatalogDialog from '@/components/collections/AddFromCatalogDialog.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import SearchInput from '@/components/SearchInput.vue';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/shadcn-components/alert-dialog';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    useCollection,
    useCollectionEntries,
    useDeleteCollection,
    useRemoveCollectionItem,
} from '@/composables/useCollections';
import { useSearchTerm } from '@/composables/useSearchTerm';
import { FORMAT_LABELS, SERIES_KIND_LABELS } from '@/lib/media-types';

import {
    ArrowLeftIcon,
    LibraryIcon,
    ScanBarcodeIcon,
    Trash2Icon,
    XIcon,
} from '@lucide/vue';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps<{ id: string }>();

const router = useRouter();

const query = ref('');
const { term, isTyping } = useSearchTerm(query);
const confirmingDelete = ref(false);
const isAddOpen = ref(false);

const { data: collection, error: loadError } = useCollection(() => props.id);

const entries = useCollectionEntries(() => props.id, term, {
    pending: isTyping,
});

const { mutate: removeItem, error: removeError } = useRemoveCollectionItem();

const {
    mutate: deleteCollection,
    isPending: isDeleting,
    error: deleteError,
} = useDeleteCollection();

function onDelete() {
    deleteCollection(props.id, {
        onSuccess: () => router.replace({ name: 'collections' }),
        onError: () => {
            confirmingDelete.value = false;
        },
    });
}

const headerError = computed(
    () =>
        (loadError.value ?? removeError.value ?? deleteError.value)?.message ??
        null
);
</script>

<template>
    <main class="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
        <div class="flex items-center justify-between">
            <Button variant="ghost" size="sm" as-child>
                <RouterLink :to="{ name: 'collections' }">
                    <ArrowLeftIcon />
                    Collections
                </RouterLink>
            </Button>
            <div class="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    :disabled="!collection"
                    @click="isAddOpen = true"
                >
                    <LibraryIcon />
                    Add from catalog
                </Button>
                <Button size="sm" as-child>
                    <RouterLink
                        :to="{ name: 'scan', query: { collection: id } }"
                    >
                        <ScanBarcodeIcon />
                        Scan
                    </RouterLink>
                </Button>
            </div>
        </div>

        <AddFromCatalogDialog
            v-if="collection"
            v-model:open="isAddOpen"
            :collection-id="id"
            :collection-name="collection.name"
        />

        <div class="flex min-h-7 items-center justify-between gap-2">
            <h1 v-if="collection" class="text-lg font-semibold">
                {{ collection.name }}
            </h1>
            <Spinner v-else-if="!headerError" />
            <AlertDialog
                v-if="collection?.role === CollectionRole.Owner"
                v-model:open="confirmingDelete"
            >
                <AlertDialogTrigger as-child>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete collection"
                    >
                        <Trash2Icon />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete {{ collection.name }}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This removes the collection and everything in it for
                            all members.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel :disabled="isDeleting">
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            variant="destructive"
                            :disabled="isDeleting"
                            @click="onDelete"
                        >
                            <Spinner v-if="isDeleting" />
                            Delete
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
        <FormError :message="headerError" />

        <SearchInput v-model="query" placeholder="Search" />

        <PagedList
            :list="entries"
            :empty-text="
                query ? 'No matches.' : 'Nothing here yet. Scan something in.'
            "
        >
            <template #default="{ items }">
                <ul class="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <li
                        v-for="entry in items"
                        :key="entry.id"
                        class="group relative"
                    >
                        <RouterLink
                            v-if="entry.series"
                            :to="{
                                name: 'collection-series',
                                params: { id, seriesId: entry.series.id },
                            }"
                            class="grid gap-1.5"
                        >
                            <CoverImage
                                size="md"
                                :src="entry.series.coverUrl"
                                :alt="entry.series.title"
                                class="aspect-2/3 w-full transition-opacity group-hover:opacity-90"
                            />
                            <p class="line-clamp-2 text-sm font-medium">
                                {{ entry.series.title }}
                            </p>
                            <div class="flex items-center gap-1.5">
                                <Badge variant="secondary">
                                    {{ SERIES_KIND_LABELS[entry.series.kind] }}
                                </Badge>
                                <span class="text-muted-foreground text-xs">
                                    {{ entry.ownedCount }} owned
                                </span>
                            </div>
                        </RouterLink>

                        <div v-else class="grid gap-1.5">
                            <CoverImage
                                size="md"
                                :src="entry.coverUrl"
                                :alt="entry.title"
                                class="aspect-2/3 w-full"
                            />
                            <p class="line-clamp-2 text-sm font-medium">
                                {{ entry.title }}
                            </p>
                            <div class="flex items-center gap-1.5">
                                <Badge variant="secondary">
                                    {{
                                        entry.kind
                                            ? SERIES_KIND_LABELS[entry.kind]
                                            : FORMAT_LABELS[entry.format]
                                    }}
                                </Badge>
                                <span
                                    v-if="entry.position !== null"
                                    class="text-muted-foreground text-xs"
                                >
                                    Vol. {{ entry.position }}
                                </span>
                            </div>
                            <Button
                                variant="secondary"
                                size="icon"
                                class="absolute top-1 right-1 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                                :aria-label="`Remove ${entry.title}`"
                                @click="removeItem({ collectionId: id, itemId: entry.id })"
                            >
                                <XIcon />
                            </Button>
                        </div>
                    </li>
                </ul>
            </template>
        </PagedList>
    </main>
</template>
