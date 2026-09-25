<script setup lang="ts">
import { Relationship } from '@analog/types';
import BackButton from '@/components/BackButton.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import InviteToCollectionsDialog from '@/components/collections/InviteToCollectionsDialog.vue';
import FormError from '@/components/FormError.vue';
import { Button } from '@/components/shadcn-components/button';
import { Spinner } from '@/components/shadcn-components/spinner';
import UserAvatar from '@/components/users/UserAvatar.vue';
import {
    useAcceptFriendRequest,
    useCancelFriendRequest,
    useDeclineFriendRequest,
    useRemoveFriend,
    useSendFriendRequest,
} from '@/composables/useFriends';
import { useUser } from '@/composables/useUsers';

import {
    CheckIcon,
    LibraryIcon,
    PencilIcon,
    UserCheckIcon,
    UserPlusIcon,
    XIcon,
} from '@lucide/vue';
import { computed, ref } from 'vue';

const props = defineProps<{ username: string }>();

const { data: person, error: loadError } = useUser(() => props.username);
const userId = computed(() => person.value?.id ?? '');
const isFriend = computed(
    () => person.value?.relationship === Relationship.Friends
);

const send = useSendFriendRequest();
const cancel = useCancelFriendRequest();
const accept = useAcceptFriendRequest();
const decline = useDeclineFriendRequest();
const remove = useRemoveFriend();
const confirmingRemove = ref(false);

const actions = [send, cancel, accept, decline, remove];
const isActing = computed(() => actions.some((a) => a.isPending.value));

function onRemove() {
    remove.mutate(
        { userId: userId.value },
        { onSettled: () => (confirmingRemove.value = false) }
    );
}

const inviting = ref(false);

const error = computed(
    () =>
        (loadError.value ?? actions.find((a) => a.error.value)?.error.value)
            ?.message ?? null
);
</script>

<template>
    <main class="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
        <div>
            <BackButton
                :to="{ name: 'friends' }"
                text="Friends"
                class="-ml-2"
            />
        </div>

        <FormError :message="error" />

        <div v-if="!person && !loadError" class="flex justify-center p-8">
            <Spinner class="size-6" />
        </div>

        <template v-if="person">
            <div class="flex flex-wrap items-center gap-3">
                <UserAvatar
                    :name="person.name"
                    :image="person.image"
                    size="lg"
                />
                <div class="grid min-w-0 flex-1 gap-0.5">
                    <h1 class="truncate text-lg font-semibold">
                        {{ person.name }}
                    </h1>
                    <p class="text-muted-foreground truncate text-sm">
                        @{{ person.username }}
                    </p>
                </div>

                <div class="flex gap-2">
                    <Button
                        v-if="person.relationship === Relationship.Self"
                        variant="outline"
                        size="sm"
                        as-child
                    >
                        <RouterLink :to="{ name: 'profile' }">
                            <PencilIcon />
                            Edit profile
                        </RouterLink>
                    </Button>

                    <Button
                        v-else-if="person.relationship === Relationship.None"
                        size="sm"
                        :disabled="isActing"
                        @click="send.mutate({ userId: person.id })"
                    >
                        <Spinner v-if="send.isPending.value" />
                        <UserPlusIcon v-else />
                        Add friend
                    </Button>

                    <template
                        v-else-if="
                            person.relationship === Relationship.RequestSent
                        "
                    >
                        <Button variant="secondary" size="sm" disabled>
                            Requested
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            :disabled="isActing"
                            @click="cancel.mutate({ userId: person.id })"
                        >
                            <Spinner v-if="cancel.isPending.value" />
                            Cancel
                        </Button>
                    </template>

                    <template
                        v-else-if="
                            person.relationship ===
                            Relationship.RequestReceived
                        "
                    >
                        <Button
                            size="sm"
                            :disabled="isActing"
                            @click="accept.mutate({ userId: person.id })"
                        >
                            <Spinner v-if="accept.isPending.value" />
                            <CheckIcon v-else />
                            Accept
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            :disabled="isActing"
                            @click="decline.mutate({ userId: person.id })"
                        >
                            <Spinner v-if="decline.isPending.value" />
                            <XIcon v-else />
                            Decline
                        </Button>
                    </template>

                    <ConfirmDialog
                        v-else
                        v-model:open="confirmingRemove"
                        :title="`Unfriend ${person.name}?`"
                        description="Pending invites between you will be canceled, and you'll both be removed from each other's collections."
                        confirm-text="Unfriend"
                        :pending="remove.isPending.value"
                        @confirm="onRemove"
                    >
                        <template #trigger>
                            <Button variant="outline" size="sm">
                                <UserCheckIcon />
                                Friends
                            </Button>
                        </template>
                    </ConfirmDialog>

                    <Button v-if="isFriend" size="sm" @click="inviting = true">
                        <LibraryIcon />
                        Invite to collection
                    </Button>
                </div>
            </div>

            <InviteToCollectionsDialog
                v-if="isFriend"
                v-model:open="inviting"
                :friend="person"
            />
        </template>
    </main>
</template>
