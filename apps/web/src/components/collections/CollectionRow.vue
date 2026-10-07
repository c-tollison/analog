<script setup lang="ts">
import type { InferResponseType } from '@analog/api/client';
import CollectionProgressBar from '@/components/collections/CollectionProgressBar.vue';
import {
    AvatarGroup,
    AvatarGroupCount,
} from '@/components/shadcn-components/avatar';
import { Badge } from '@/components/shadcn-components/badge';
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemTitle,
} from '@/components/shadcn-components/item';
import UserAvatar from '@/components/users/UserAvatar.vue';
import type { ApiClient } from '@/lib/api';

import { LockIcon } from '@lucide/vue';

type CollectionSummary = InferResponseType<
    ApiClient['collections']['$get'],
    200
>['items'][number];

defineProps<{ collection: CollectionSummary; showProgress: boolean }>();
</script>

<!-- A collection in a list. The whole row opens it. -->
<template>
    <Item variant="outline" class="has-[a:hover]:bg-muted relative">
        <ItemContent class="min-w-0">
            <div class="flex h-6 items-center justify-between gap-2">
                <div class="flex min-w-0 items-center gap-2">
                    <ItemTitle class="min-w-0">
                        <RouterLink
                            :to="{
                                name: 'collection',
                                params: { id: collection.id },
                            }"
                            class="truncate after:absolute after:inset-0"
                        >
                            {{ collection.name }}
                        </RouterLink>
                    </ItemTitle>
                    <Badge v-if="!collection.isPublic" variant="secondary">
                        <LockIcon />
                        Private
                    </Badge>
                </div>
                <AvatarGroup v-if="collection.memberCount > 1" class="shrink-0">
                    <UserAvatar
                        v-for="member in collection.members"
                        :key="member.id"
                        :name="member.name"
                        :image="member.image"
                        size="sm"
                    />
                    <AvatarGroupCount
                        v-if="collection.memberCount > collection.members.length"
                    >
                        +{{
                            collection.memberCount - collection.members.length
                        }}
                    </AvatarGroupCount>
                </AvatarGroup>
            </div>
            <ItemDescription>
                {{ collection.editionCount }}
                {{ collection.editionCount === 1 ? 'item' : 'items' }}
                <template v-if="collection.itemCount && !showProgress">
                    · {{ collection.completedCount }}
                    read
                </template>
            </ItemDescription>
            <CollectionProgressBar
                v-if="showProgress"
                class="mt-1"
                :class="{ invisible: !collection.itemCount }"
                :total="collection.itemCount"
                :completed="collection.completedCount"
                :in-progress="collection.inProgressCount"
                :planned="collection.plannedCount"
            />
        </ItemContent>
    </Item>
</template>
