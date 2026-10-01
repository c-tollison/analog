<script setup lang="ts">
import { CollectionRole } from '@analog/types';
import BackButton from '@/components/BackButton.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import FormError from '@/components/FormError.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { ItemGroup } from '@/components/shadcn-components/item';
import { Label } from '@/components/shadcn-components/label';
import { Separator } from '@/components/shadcn-components/separator';
import { Spinner } from '@/components/shadcn-components/spinner';
import { Switch } from '@/components/shadcn-components/switch';
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
    useUpdateCollection,
} from '@/composables/useCollections';
import { useQueryParam } from '@/composables/useQueryParam';
import { useSessionStore } from '@/stores/session';

import { LogOutIcon, Trash2Icon, UserPlusIcon, XIcon } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps<{ id: string }>();

const router = useRouter();
const { session } = storeToRefs(useSessionStore());

// The open tab lives in the URL so coming back from the invite page lands
// on Members.
const tab = useQueryParam('tab', ['general', 'members'], 'general');

const { data: collection, error: loadError } = useCollection(() => props.id);
const isOwner = computed(() => collection.value?.role === CollectionRole.Owner);

const members = useCollectionMembers(() => props.id);
const invites = useCollectionInvites(() => props.id, isOwner);

const cancelInvite = useCancelInvite();
const removeMember = useRemoveMember();
const leave = useLeaveCollection();
const deleteCollection = useDeleteCollection();
const update = useUpdateCollection();

// Follows the switch while the save is in flight.
const isPublic = computed(
    () =>
        (update.isPending.value
            ? update.variables.value?.isPublic
            : undefined) ??
        collection.value?.isPublic ??
        false
);
const isProfilePublic = computed(() => session.value?.user.isPublic ?? false);
const whoCanSee = computed(() => {
    if (!isPublic.value) return 'Only members can see it.';
    return isProfilePublic.value
        ? 'Anyone on Analog can see it.'
        : 'Your friends can see it.';
});

const confirmingPublic = ref(false);

// Going public asks first; going private doesn't.
function onPublicChange(value: boolean) {
    if (value) {
        confirmingPublic.value = true;
    } else {
        update.mutate({ collectionId: props.id, isPublic: false });
    }
}

function onConfirmPublic() {
    update.mutate(
        { collectionId: props.id, isPublic: true },
        { onSettled: () => (confirmingPublic.value = false) }
    );
}

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
            [cancelInvite, removeMember, leave, deleteCollection, update].find(
                (m) => m.error.value
            )?.error.value
        )?.message ?? null
);
</script>

<template>
    <div class="flex flex-col gap-4">
        <div>
            <BackButton
                :to="{ name: 'collection', params: { id } }"
                :text="collection?.name ?? 'Shelf'"
                class="-ml-2"
            />
        </div>

        <h1 class="text-lg font-semibold">Settings</h1>

        <FormError :message="error" />

        <ConfirmDialog
            v-model:open="confirmingRemove"
            :title="`Remove ${removing?.name ?? 'member'}?`"
            description="They won't be able to see or edit this shelf anymore."
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
                    <div class="flex items-center justify-between gap-4">
                        <div class="grid gap-1">
                            <Label for="public-collection">
                                Public shelf
                            </Label>
                            <p class="text-muted-foreground text-sm">
                                {{ whoCanSee }}
                            </p>
                        </div>
                        <Switch
                            id="public-collection"
                            :model-value="isPublic"
                            :disabled="update.isPending.value"
                            @update:model-value="onPublicChange"
                        />
                    </div>
                    <ConfirmDialog
                        v-model:open="confirmingPublic"
                        :title="`Make ${collection.name} public?`"
                        :description="
                            isProfilePublic
                                ? 'Anyone on Analog will be able to see it.'
                                : 'Your friends will be able to see it.'
                        "
                        confirm-text="Make public"
                        variant="default"
                        :pending="update.isPending.value"
                        @confirm="onConfirmPublic"
                    />

                    <Separator />

                    <h2 class="font-medium">Delete shelf</h2>
                    <div>
                        <ConfirmDialog
                            v-model:open="confirmingDelete"
                            :title="`Delete ${collection.name}?`"
                            description="This deletes the shelf. It can't be restored."
                            confirm-text="Delete"
                            :pending="deleteCollection.isPending.value"
                            @confirm="onDelete"
                        >
                            <template #trigger>
                                <Button variant="destructive" size="sm">
                                    <Trash2Icon />
                                    Delete shelf
                                </Button>
                            </template>
                        </ConfirmDialog>
                    </div>
                </template>
                <template v-else>
                    <h2 class="font-medium">Leave shelf</h2>
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
                                    Leave shelf
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
    </div>
</template>
