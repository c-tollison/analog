<script setup lang="ts">
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from '@/components/shadcn-components/item';

import UserAvatar from './UserAvatar.vue';

defineProps<{
    user: { name: string; username: string; image: string | null };
}>();

defineSlots<{
    description?(): unknown;
    actions?(): unknown;
}>();
</script>

<!-- A person in a list. The whole row opens their page; actions sit above
the link so they stay clickable. -->
<template>
    <Item variant="outline" class="has-[a:hover]:bg-muted relative">
        <ItemMedia>
            <UserAvatar :name="user.name" :image="user.image" />
        </ItemMedia>
        <ItemContent class="min-w-0">
            <ItemTitle class="w-full">
                <RouterLink
                    :to="{ name: 'user', params: { username: user.username } }"
                    class="truncate after:absolute after:inset-0"
                >
                    {{ user.name }}
                </RouterLink>
            </ItemTitle>
            <ItemDescription class="truncate">
                <slot name="description">@{{ user.username }}</slot>
            </ItemDescription>
        </ItemContent>
        <ItemActions v-if="$slots.actions" class="relative">
            <slot name="actions" />
        </ItemActions>
    </Item>
</template>
