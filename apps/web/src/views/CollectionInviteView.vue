<script setup lang="ts">
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

import { ArrowLeftIcon } from '@lucide/vue';
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
    <main class="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
        <div>
            <Button variant="ghost" size="sm" class="-ml-2" as-child>
                <RouterLink
                    :to="{
                        name: 'collection-settings',
                        params: { id },
                        query: { tab: 'members' },
                    }"
                >
                    <ArrowLeftIcon />
                    Members
                </RouterLink>
            </Button>
        </div>

        <div class="grid gap-1">
            <h1 class="text-lg font-semibold">Invite friends</h1>
            <p class="text-muted-foreground text-sm">
                Once they accept, they can add and edit media in
                {{ collection?.name ?? 'this collection' }}.
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
                        v-for="friend in items"
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
    </main>
</template>
