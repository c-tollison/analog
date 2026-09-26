<script setup lang="ts">
import { Relationship, USER_SEARCH_MIN_LENGTH } from '@analog/types';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import SearchInput from '@/components/SearchInput.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { ItemGroup } from '@/components/shadcn-components/item';
import { Spinner } from '@/components/shadcn-components/spinner';
import UserItem from '@/components/users/UserItem.vue';
import {
    useAcceptFriendRequest,
    useDeclineFriendRequest,
    useFriendRequests,
    useFriends,
} from '@/composables/useFriends';
import { useSearchTerm } from '@/composables/useSearchTerm';
import { useUserSearch } from '@/composables/useUsers';

import { CheckIcon, XIcon } from '@lucide/vue';
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
const answerError = computed(
    () =>
        (acceptRequest.error.value ?? declineRequest.error.value)?.message ??
        null
);

// The request and button being answered, so only that one shows a spinner.
const answering = ref<{ userId: string; accept: boolean } | null>(null);

function answer(userId: string, accept: boolean) {
    answering.value = { userId, accept };
    const mutation = accept ? acceptRequest : declineRequest;
    mutation.mutate({ userId }, { onSettled: () => (answering.value = null) });
}

function isAnswering(userId: string, accept: boolean) {
    return (
        answering.value?.userId === userId && answering.value.accept === accept
    );
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
            <FormError :message="answerError" />

            <section v-if="requests.items.length" class="grid gap-2">
                <h2 class="text-sm font-medium">Friend requests</h2>
                <PagedList :list="requests" empty-text="">
                    <template #default="{ items }">
                        <ItemGroup class="gap-2">
                            <UserItem
                                v-for="person in items"
                                :key="person.id"
                                :user="person"
                            >
                                <template #actions>
                                    <Button
                                        size="sm"
                                        :disabled="answering !== null"
                                        @click="answer(person.id, true)"
                                    >
                                        <Spinner
                                            v-if="isAnswering(person.id, true)"
                                        />
                                        <CheckIcon v-else />
                                        Accept
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        :disabled="answering !== null"
                                        @click="answer(person.id, false)"
                                    >
                                        <Spinner
                                            v-if="isAnswering(person.id, false)"
                                        />
                                        <XIcon v-else />
                                        Decline
                                    </Button>
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
