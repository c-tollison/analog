<script setup lang="ts">
import FormError from '@/components/FormError.vue';
import PagedList from '@/components/lists/PagedList.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/shadcn-components/dialog';
import {
    Item,
    ItemActions,
    ItemContent,
    ItemGroup,
    ItemTitle,
} from '@/components/shadcn-components/item';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    useFriendCollections,
    useInviteToCollection,
} from '@/composables/useCollections';

import { watch } from 'vue';

const props = defineProps<{ friend: { id: string; name: string } }>();

const open = defineModel<boolean>('open', { required: true });

const collections = useFriendCollections(() => props.friend.id, {
    enabled: open,
});
const invite = useInviteToCollection();

watch(open, (isOpen) => {
    if (isOpen) {
        invite.reset();
    }
});
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="flex max-h-[85svh] flex-col sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Invite {{ friend.name }}</DialogTitle>
                <DialogDescription>
                    Pick the collections to share with them.
                </DialogDescription>
            </DialogHeader>

            <FormError :message="invite.error.value?.message ?? null" />

            <div class="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
                <PagedList
                    :list="collections"
                    empty-text="You don't own any collections yet."
                >
                    <template #default="{ items }">
                        <ItemGroup class="gap-2">
                            <Item
                                v-for="c in items"
                                :key="c.id"
                                variant="outline"
                                size="sm"
                            >
                                <ItemContent>
                                    <ItemTitle>{{ c.name }}</ItemTitle>
                                </ItemContent>
                                <ItemActions>
                                    <Badge
                                        v-if="c.isMember"
                                        variant="secondary"
                                    >
                                        Member
                                    </Badge>
                                    <Badge
                                        v-else-if="c.isInvited"
                                        variant="secondary"
                                    >
                                        Invited
                                    </Badge>
                                    <Button
                                        v-else
                                        size="sm"
                                        variant="outline"
                                        :disabled="invite.isPending.value"
                                        @click="
                                            invite.mutate({
                                                collectionId: c.id,
                                                userId: friend.id,
                                            })
                                        "
                                    >
                                        <Spinner
                                            v-if="
                                                invite.isPending.value &&
                                                invite.variables.value
                                                    ?.collectionId === c.id
                                            "
                                        />
                                        Invite
                                    </Button>
                                </ItemActions>
                            </Item>
                        </ItemGroup>
                    </template>
                </PagedList>
            </div>
        </DialogContent>
    </Dialog>
</template>
