<script setup lang="ts">
import { Relationship, USER_SEARCH_MIN_LENGTH } from '@analog/types';
import PagedList from '@/components/lists/PagedList.vue';
import SearchInput from '@/components/SearchInput.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { ItemGroup } from '@/components/shadcn-components/item';
import UserItem from '@/components/users/UserItem.vue';
import { useFriends } from '@/composables/useFriends';
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
const results = useUserSearch(searchTerm, {
    enabled: () => searchTerm.value !== '',
    pending: isTyping,
});
</script>

<template>
    <main class="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
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

        <PagedList
            v-else
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
    </main>
</template>
