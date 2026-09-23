<script setup lang="ts">
import type { InferResponseType } from '@analog/api/client';
import { NotificationKind } from '@analog/types';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import { Button } from '@/components/shadcn-components/button';
import { ItemGroup } from '@/components/shadcn-components/item';
import { Spinner } from '@/components/shadcn-components/spinner';
import UserItem from '@/components/users/UserItem.vue';
import {
    useAcceptFriendRequest,
    useDeclineFriendRequest,
} from '@/composables/useFriends';
import {
    useAcceptInvite,
    useDeclineInvite,
    useNotifications,
} from '@/composables/useNotifications';
import type { ApiClient } from '@/lib/api';

import { CheckIcon, XIcon } from '@lucide/vue';
import { computed, ref } from 'vue';

type Notification = InferResponseType<
    ApiClient['notifications']['$get'],
    200
>['items'][number];

const notifications = useNotifications();

const acceptRequest = useAcceptFriendRequest();
const declineRequest = useDeclineFriendRequest();
const acceptInvite = useAcceptInvite();
const declineInvite = useDeclineInvite();

const actions = [acceptRequest, declineRequest, acceptInvite, declineInvite];
const error = computed(
    () => actions.find((a) => a.error.value)?.error.value?.message ?? null
);

// The row and button being answered, so only that one shows a spinner.
const answering = ref<{ key: string; accept: boolean } | null>(null);

function rowKey(n: Notification) {
    return `${n.kind}:${n.userId}:${n.collectionId ?? ''}`;
}

function answer(n: Notification, accept: boolean) {
    answering.value = { key: rowKey(n), accept };
    const done = { onSettled: () => (answering.value = null) };
    if (n.kind === NotificationKind.FriendRequest) {
        const mutation = accept ? acceptRequest : declineRequest;
        mutation.mutate({ userId: n.userId }, done);
    } else if (n.collectionId) {
        const mutation = accept ? acceptInvite : declineInvite;
        mutation.mutate({ collectionId: n.collectionId }, done);
    }
}

function isAnswering(n: Notification, accept: boolean) {
    return (
        answering.value?.key === rowKey(n) && answering.value.accept === accept
    );
}
</script>

<template>
    <main class="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
        <h1 class="text-lg font-semibold">Notifications</h1>

        <FormError :message="error" />

        <PagedList :list="notifications" empty-text="You're all caught up.">
            <template #default="{ items }">
                <ItemGroup class="gap-2">
                    <UserItem v-for="n in items" :key="rowKey(n)" :user="n">
                        <template #description>
                            <template
                                v-if="n.kind === NotificationKind.FriendRequest"
                            >
                                @{{ n.username }} wants to be friends
                            </template>
                            <template v-else>
                                Invited you to
                                <span class="text-foreground font-medium">
                                    {{ n.collectionName }}
                                </span>
                            </template>
                        </template>
                        <template #actions>
                            <Button
                                size="sm"
                                :disabled="answering !== null"
                                @click="answer(n, true)"
                            >
                                <Spinner v-if="isAnswering(n, true)" />
                                <CheckIcon v-else />
                                Accept
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                :disabled="answering !== null"
                                @click="answer(n, false)"
                            >
                                <Spinner v-if="isAnswering(n, false)" />
                                <XIcon v-else />
                                Decline
                            </Button>
                        </template>
                    </UserItem>
                </ItemGroup>
            </template>
        </PagedList>
    </main>
</template>
