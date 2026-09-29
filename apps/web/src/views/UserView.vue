<script setup lang="ts">
import { Relationship } from '@analog/types';
import BackButton from '@/components/BackButton.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import CollectionRow from '@/components/collections/CollectionRow.vue';
import InviteToCollectionsDialog from '@/components/collections/InviteToCollectionsDialog.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import { Button } from '@/components/shadcn-components/button';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/shadcn-components/empty';
import { ItemGroup } from '@/components/shadcn-components/item';
import { Spinner } from '@/components/shadcn-components/spinner';
import UserAvatar from '@/components/users/UserAvatar.vue';
import { useUserCollections } from '@/composables/useCollections';
import {
    useAcceptFriendRequest,
    useCancelFriendRequest,
    useDeclineFriendRequest,
    useRemoveFriend,
    useSendFriendRequest,
} from '@/composables/useFriends';
import { usePageTitle } from '@/composables/usePageTitle';
import { useUser } from '@/composables/useUsers';
import { staggerIn } from '@/lib/motion';
import { useSessionStore } from '@/stores/session';

import {
    CheckIcon,
    LibraryIcon,
    LockIcon,
    PencilIcon,
    UserCheckIcon,
    UserPlusIcon,
    XIcon,
} from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';

const props = defineProps<{ username: string }>();

const { data: person, error: loadError } = useUser(() => props.username);
usePageTitle(() => person.value?.name);
const userId = computed(() => person.value?.id ?? '');
const isFriend = computed(
    () => person.value?.relationship === Relationship.Friends
);

// A private profile shows its collections to friends only.
const canSeeCollections = computed(
    () =>
        !!person.value &&
        (person.value.isPublic ||
            person.value.relationship === Relationship.Self ||
            person.value.relationship === Relationship.Friends)
);
const collections = useUserCollections(() => props.username, {
    enabled: canSeeCollections,
});

const { session } = storeToRefs(useSessionStore());
const showProgress = computed(
    () => session.value?.user.showCollectionProgress ?? true
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
    <div class="flex flex-col gap-4">
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
            <div
                class="motion-safe:animate-in fade-in animation-duration-500 flex items-center gap-4"
            >
                <UserAvatar
                    :name="person.name"
                    :image="person.image"
                    size="xl"
                />
                <div class="grid min-w-0 flex-1 gap-2">
                    <div class="grid gap-0.5">
                        <h1 class="truncate text-lg font-semibold">
                            {{ person.name }}
                        </h1>
                        <p class="text-muted-foreground truncate text-sm">
                            @{{ person.username }}
                        </p>
                    </div>

                    <div class="flex flex-wrap gap-2">
                        <Button
                            v-if="person.relationship === Relationship.Self"
                            variant="outline"
                            size="sm"
                            as-child
                        >
                            <RouterLink :to="{ name: 'profile-settings' }">
                                <PencilIcon />
                                Edit profile
                            </RouterLink>
                        </Button>

                        <Button
                            v-else-if="
                                person.relationship === Relationship.None
                            "
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

                        <Button
                            v-if="isFriend"
                            size="sm"
                            @click="inviting = true"
                        >
                            <LibraryIcon />
                            Invite to collection
                        </Button>
                    </div>
                </div>
            </div>

            <template v-if="canSeeCollections">
                <h2 class="font-medium">Collections</h2>
                <PagedList :list="collections" empty-text="No collections yet.">
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
            </template>
            <Empty
                v-else
                class="motion-safe:animate-in fade-in animation-duration-500"
            >
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <LockIcon />
                    </EmptyMedia>
                    <EmptyTitle>This profile is private</EmptyTitle>
                    <EmptyDescription>
                        Only friends can see {{ person.name }}'s collections.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>

            <InviteToCollectionsDialog
                v-if="isFriend"
                v-model:open="inviting"
                :friend="person"
            />
        </template>
    </div>
</template>
