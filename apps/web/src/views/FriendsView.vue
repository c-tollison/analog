<script setup lang="ts">
import { Relationship, USER_SEARCH_MIN_LENGTH } from '@analog/types';
import AcceptDeclineButtons from '@/components/AcceptDeclineButtons.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import SearchInput from '@/components/SearchInput.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { ItemGroup } from '@/components/shadcn-components/item';
import UserItem from '@/components/users/UserItem.vue';
import {
    useAcceptFriendRequest,
    useDeclineFriendRequest,
    useFriendRequests,
    useFriends,
} from '@/composables/useFriends';
import { useSearchTerm } from '@/composables/useSearchTerm';
import { useUserSearch } from '@/composables/useUsers';

import { computed, ref } from 'vue';

const RELATIONSHIP_LABELS: Partial<Record<Relationship, string>> = {
    [Relationship.Friends]: 'Friend',
    [Relationship.RequestSent]: 'Requested',
    [Relationship.RequestReceived]: 'Wants to be friends',
};

const query = ref('');
const { trimmed, term, isTyping } = useSearchTerm(query);

// Short queries keep showing friends; longer ones search everyone.
const isSearching = computed(
    () => trimmed.value.length >= USER_SEARCH_MIN_LENGTH
);
const searchTerm = computed(() =>
    term.value.length >= USER_SEARCH_MIN_LENGTH ? term.value : ''
);

const friends = useFriends('');
const requests = useFriendRequests();

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

const results = useUserSearch(searchTerm, {
    enabled: () => searchTerm.value !== '',
    pending: isTyping,
});
</script>

<template>
    <div class="flex flex-col gap-4">
        <h1 class="text-lg font-semibold">Friends</h1>

        <SearchInput
            v-model="query"
            placeholder="Find people by name or username"
        />

        <PagedList
            v-if="isSearching"
            :list="results"
            empty-text="No one matches."
        >
            <template #default="{ items }">
                <ItemGroup class="gap-2">
                    <UserItem
                        v-for="person in items"
                        :key="person.id"
                        :user="person"
                    >
                        <template
                            v-if="RELATIONSHIP_LABELS[person.relationship]"
                            #actions
                        >
                            <Badge variant="secondary">
                                {{ RELATIONSHIP_LABELS[person.relationship] }}
                            </Badge>
                        </template>
                    </UserItem>
                </ItemGroup>
            </template>
        </PagedList>

        <template v-else>
            <section
                v-if="
                    requests.isLoading ||
                    requests.error ||
                    requests.items.length
                "
                class="grid gap-2"
            >
                <h2 class="text-sm font-medium">Friend requests</h2>
                <FormError :message="answerError" />
                <PagedList :list="requests" empty-text="No pending requests.">
                    <template #default="{ items }">
                        <ItemGroup class="gap-2">
                            <UserItem
                                v-for="person in items"
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
            </section>

            <PagedList
                :list="friends"
                empty-text="No friends yet. Search for someone to send a request."
            >
                <template #default="{ items }">
                    <ItemGroup class="gap-2">
                        <UserItem
                            v-for="friend in items"
                            :key="friend.id"
                            :user="friend"
                        />
                    </ItemGroup>
                </template>
            </PagedList>
        </template>
    </div>
</template>
