<script setup lang="ts">
import AcceptDeclineButtons from '@/components/AcceptDeclineButtons.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { ItemGroup } from '@/components/shadcn-components/item';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/shadcn-components/tabs';
import UserItem from '@/components/users/UserItem.vue';
import {
    useAcceptFriendRequest,
    useDeclineFriendRequest,
    useFriendRequests,
    useFriends,
} from '@/composables/useFriends';
import { useNotificationCount } from '@/composables/useNotifications';
import { staggerIn } from '@/lib/motion';

import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const TABS = ['friends', 'requests'] as const;
type Tab = (typeof TABS)[number];

function isTab(value: unknown): value is Tab {
    return TABS.some((tab) => tab === value);
}

const route = useRoute();
const router = useRouter();

const tab = computed({
    get: (): Tab => (isTab(route.query.tab) ? route.query.tab : 'friends'),
    set: (value) => {
        router.replace({ query: { ...route.query, tab: value } });
    },
});

const friends = useFriends('');
const requests = useFriendRequests();
const { data: counts } = useNotificationCount();

const acceptRequest = useAcceptFriendRequest();
const declineRequest = useDeclineFriendRequest();

const actions = [acceptRequest, declineRequest];
const answerError = computed(
    () => actions.find((a) => a.error.value)?.error.value?.message ?? null
);

// The request and button being answered, so only that one shows a spinner.
const answering = ref<{ userId: string; action: 'accept' | 'decline' } | null>(
    null
);

function answer(userId: string, action: 'accept' | 'decline') {
    for (const a of actions) a.reset();
    answering.value = { userId, action };
    const mutation = action === 'accept' ? acceptRequest : declineRequest;
    mutation.mutate({ userId }, { onSettled: () => (answering.value = null) });
}

function pendingFor(userId: string) {
    return answering.value?.userId === userId
        ? answering.value.action
        : undefined;
}
</script>

<template>
    <div class="flex flex-col gap-4">
        <h1 class="text-lg font-semibold">Friends</h1>

        <Tabs v-model="tab">
            <TabsList>
                <TabsTrigger value="friends">Friends</TabsTrigger>
                <TabsTrigger value="requests">
                    Requests
                    <Badge v-if="counts?.friendRequests" variant="secondary">
                        {{ counts.friendRequests }}
                    </Badge>
                </TabsTrigger>
            </TabsList>

            <TabsContent value="friends" class="pt-2">
                <PagedList
                    :list="friends"
                    empty-text="No friends yet. Search for someone to send a request."
                >
                    <template #default="{ items }">
                        <ItemGroup class="gap-2">
                            <UserItem
                                v-for="(friend, index) in items"
                                v-bind="staggerIn(index)"
                                :key="friend.id"
                                :user="friend"
                            />
                        </ItemGroup>
                    </template>
                </PagedList>
            </TabsContent>

            <TabsContent value="requests" class="grid gap-2 pt-2">
                <FormError :message="answerError" />
                <PagedList :list="requests" empty-text="No pending requests.">
                    <template #default="{ items }">
                        <ItemGroup class="gap-2">
                            <UserItem
                                v-for="(person, index) in items"
                                v-bind="staggerIn(index)"
                                :key="person.id"
                                :user="person"
                            >
                                <template #actions>
                                    <AcceptDeclineButtons
                                        :disabled="answering !== null"
                                        :pending="pendingFor(person.id)"
                                        @accept="answer(person.id, 'accept')"
                                        @decline="answer(person.id, 'decline')"
                                    />
                                </template>
                            </UserItem>
                        </ItemGroup>
                    </template>
                </PagedList>
            </TabsContent>
        </Tabs>
    </div>
</template>
