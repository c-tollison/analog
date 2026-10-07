<script setup lang="ts">
import BackButton from '@/components/BackButton.vue';
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import SearchInput from '@/components/SearchInput.vue';
import { Button } from '@/components/shadcn-components/button';
import { ItemGroup } from '@/components/shadcn-components/item';
import { Spinner } from '@/components/shadcn-components/spinner';
import UserItem from '@/components/users/UserItem.vue';
import {
    useCollection,
    useInvitableFriends,
    useInviteToCollection,
} from '@/composables/useCollections';
import { useSearchTerm } from '@/composables/useSearchTerm';
import { staggerIn } from '@/lib/motion';

import { computed, ref } from 'vue';

const props = defineProps<{ id: string }>();

const { data: collection, error: loadError } = useCollection(() => props.id);

const query = ref('');
const { term, isTyping } = useSearchTerm(query);
const invitable = useInvitableFriends(() => props.id, term, {
    pending: isTyping,
});

const invite = useInviteToCollection();

const error = computed(
    () => (loadError.value ?? invite.error.value)?.message ?? null
);
</script>

<template>
    <div class="flex flex-col gap-4">
        <div>
            <BackButton
                :to="{
                    name: 'collection-settings',
                    params: { id },
                    query: { tab: 'members' },
                }"
                text="Members"
                class="-ml-2"
            />
        </div>

        <div class="grid gap-1">
            <h1 class="text-lg font-semibold">Invite friends</h1>
            <p class="text-muted-foreground text-sm">
                Once they accept, they can add and edit books in
                {{ collection?.name ?? 'this shelf' }}.
            </p>
        </div>

        <FormError :message="error" />

        <SearchInput v-model="query" placeholder="Search friends" />

        <PagedList
            :list="invitable"
            :empty-text="
                query
                    ? 'No friends match.'
                    : 'Every friend is already in or invited.'
            "
        >
            <template #default="{ items }">
                <ItemGroup class="gap-2">
                    <UserItem
                        v-for="(friend, index) in items"
                        v-bind="staggerIn(index)"
                        :key="friend.id"
                        :user="friend"
                    >
                        <template #actions>
                            <Button
                                size="sm"
                                variant="outline"
                                :disabled="invite.isPending.value"
                                @click="
                                    invite.mutate({
                                        collectionId: id,
                                        userId: friend.id,
                                    })
                                "
                            >
                                <Spinner
                                    v-if="
                                        invite.isPending.value &&
                                        invite.variables.value?.userId ===
                                            friend.id
                                    "
                                />
                                Invite
                            </Button>
                        </template>
                    </UserItem>
                </ItemGroup>
            </template>
        </PagedList>
    </div>
</template>
