<script setup lang="ts">
import { CollectionRole } from '@analog/types';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import FormError from '@/components/FormError.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { ItemGroup } from '@/components/shadcn-components/item';
import { Separator } from '@/components/shadcn-components/separator';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/shadcn-components/tabs';
import UserItem from '@/components/users/UserItem.vue';
import {
    useCancelInvite,
    useCollection,
    useCollectionInvites,
    useCollectionMembers,
    useDeleteCollection,
    useLeaveCollection,
    useRemoveMember,
} from '@/composables/useCollections';
import { useSessionStore } from '@/stores/session';

import {
    ArrowLeftIcon,
    LogOutIcon,
    Trash2Icon,
    UserPlusIcon,
    XIcon,
} from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const TABS = ['general', 'members'] as const;
type Tab = (typeof TABS)[number];

function isTab(value: unknown): value is Tab {
    return TABS.some((tab) => tab === value);
}

const props = defineProps<{ id: string }>();

const route = useRoute();
const router = useRouter();
const { session } = storeToRefs(useSessionStore());

// The open tab lives in the URL so coming back from the invite page lands
// on Members.
const tab = computed({
    get: (): Tab => (isTab(route.query.tab) ? route.query.tab : 'general'),
    set: (value) => {
        router.replace({ query: { ...route.query, tab: value } });
    },
});

const { data: collection, error: loadError } = useCollection(() => props.id);
const isOwner = computed(() => collection.value?.role === CollectionRole.Owner);

const members = useCollectionMembers(() => props.id);
const invites = useCollectionInvites(() => props.id, isOwner);

const cancelInvite = useCancelInvite();
const removeMember = useRemoveMember();
const leave = useLeaveCollection();
const deleteCollection = useDeleteCollection();

const removing = ref<{ id: string; name: string } | null>(null);
const confirmingRemove = computed({
    get: () => removing.value !== null,
    set: (open) => {
        if (!open) removing.value = null;
    },
});
const confirmingLeave = ref(false);
const confirmingDelete = ref(false);

function onRemove() {
    if (!removing.value) return;
    removeMember.mutate(
        { collectionId: props.id, userId: removing.value.id },
        { onSettled: () => (removing.value = null) }
    );
}

function onLeave() {
    const userId = session.value?.user.id;
    if (!userId) return;
    leave.mutate(
        { collectionId: props.id, userId },
        {
            onSuccess: () => router.replace({ name: 'collections' }),
            onError: () => (confirmingLeave.value = false),
        }
    );
}

function onDelete() {
    deleteCollection.mutate(props.id, {
        onSuccess: () => router.replace({ name: 'collections' }),
        onError: () => (confirmingDelete.value = false),
    });
}

const error = computed(
    () =>
        (
            loadError.value ??
            members.error.value ??
            invites.error.value ??
            [cancelInvite, removeMember, leave, deleteCollection].find(
                (m) => m.error.value
            )?.error.value
        )?.message ?? null
);
</script>

<template>
    <main class="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
        <div>
            <Button variant="ghost" size="sm" class="-ml-2" as-child>
                <RouterLink :to="{ name: 'collection', params: { id } }">
                    <ArrowLeftIcon />
                    {{ collection?.name ?? 'Collection' }}
                </RouterLink>
            </Button>
        </div>

        <h1 class="text-lg font-semibold">Settings</h1>

        <FormError :message="error" />

        <ConfirmDialog
            v-model:open="confirmingRemove"
            :title="`Remove ${removing?.name ?? 'member'}?`"
            description="They won't be able to see or edit this collection anymore."
            confirm-text="Remove"
            :pending="removeMember.isPending.value"
            @confirm="onRemove"
        />

        <Tabs v-model="tab">
            <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="members">Members</TabsTrigger>
            </TabsList>

            <TabsContent value="general" class="grid gap-4 pt-2">
                <div v-if="!collection" class="flex justify-center p-8">
                    <Spinner v-if="!loadError" class="size-6" />
                </div>
                <template v-else-if="isOwner">
                    <h2 class="font-medium">Delete collection</h2>
                    <div>
                        <ConfirmDialog
                            v-model:open="confirmingDelete"
                            :title="`Delete ${collection.name}?`"
                            description="This deletes the collection. It can't be restored."
                            confirm-text="Delete"
                            :pending="deleteCollection.isPending.value"
                            @confirm="onDelete"
                        >
                            <template #trigger>
                                <Button variant="destructive" size="sm">
                                    <Trash2Icon />
                                    Delete collection
                                </Button>
                            </template>
                        </ConfirmDialog>
                    </div>
                </template>
                <template v-else>
                    <h2 class="font-medium">Leave collection</h2>
                    <div>
                        <ConfirmDialog
                            v-model:open="confirmingLeave"
                            :title="`Leave ${collection.name}?`"
                            description="You'll lose access until you're invited back."
                            confirm-text="Leave"
                            :pending="leave.isPending.value"
                            @confirm="onLeave"
                        >
                            <template #trigger>
                                <Button variant="outline" size="sm">
                                    <LogOutIcon />
                                    Leave collection
                                </Button>
                            </template>
                        </ConfirmDialog>
                    </div>
                </template>
            </TabsContent>

            <TabsContent value="members" class="grid gap-4 pt-2">
                <div class="flex items-center justify-between gap-2">
                    <h2 class="font-medium">Members</h2>
                    <Button v-if="isOwner" variant="outline" size="sm" as-child>
                        <RouterLink
                            :to="{ name: 'collection-invite', params: { id } }"
                        >
                            <UserPlusIcon />
                            Invite friends
                        </RouterLink>
                    </Button>
                </div>

                <div
                    v-if="members.isPending.value"
                    class="flex justify-center p-8"
                >
                    <Spinner class="size-6" />
                </div>
                <ItemGroup v-else-if="members.data.value" class="gap-2">
                    <UserItem
                        v-for="member in members.data.value"
                        :key="member.id"
                        :user="member"
                    >
                        <template #actions>
                            <Badge variant="secondary">
                                {{
                                    member.role === CollectionRole.Owner
                                        ? 'Owner'
                                        : 'Editor'
                                }}
                            </Badge>
                            <Button
                                v-if="
                                    isOwner &&
                                    member.role === CollectionRole.Editor
                                "
                                variant="ghost"
                                size="icon-sm"
                                :aria-label="`Remove ${member.name}`"
                                @click="
                                    removing = {
                                        id: member.id,
                                        name: member.name,
                                    }
                                "
                            >
                                <XIcon />
                            </Button>
                        </template>
                    </UserItem>
                </ItemGroup>

                <template v-if="isOwner && invites.data.value?.length">
                    <Separator />
                    <h2 class="font-medium">Invited</h2>
                    <ItemGroup class="gap-2">
                        <UserItem
                            v-for="person in invites.data.value"
                            :key="person.id"
                            :user="person"
                        >
                            <template #actions>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    :disabled="cancelInvite.isPending.value"
                                    @click="
                                        cancelInvite.mutate({
                                            collectionId: id,
                                            userId: person.id,
                                        })
                                    "
                                >
                                    <Spinner
                                        v-if="
                                            cancelInvite.isPending.value &&
                                            cancelInvite.variables.value
                                                ?.userId === person.id
                                        "
                                    />
                                    Cancel invite
                                </Button>
                            </template>
                        </UserItem>
                    </ItemGroup>
                </template>
            </TabsContent>
        </Tabs>
    </main>
</template>
