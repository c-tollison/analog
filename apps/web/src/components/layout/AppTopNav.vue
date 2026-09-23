<script setup lang="ts">
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from '@/components/shadcn-components/navigation-menu';

import NotificationsBell from './NotificationsBell.vue';
import UserMenu from './UserMenu.vue';
import { DiscAlbumIcon, LibraryBigIcon, UsersIcon } from '@lucide/vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const links = [
    { name: 'collections', label: 'Collections', icon: LibraryBigIcon },
    { name: 'friends', label: 'Friends', icon: UsersIcon },
] as const;

// Nested pages (a collection, a series) keep their section highlighted.
function isActive(name: string) {
    return route.path.startsWith(`/${name}`);
}
</script>

<template>
    <header
        class="bg-background fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-2 border-b px-3 md:px-4"
    >
        <RouterLink
            :to="{ name: 'home' }"
            class="mr-2 flex items-center"
            aria-label="Analog home"
        >
            <!-- TODO: swap for the Analog logo. -->
            <DiscAlbumIcon class="size-6" />
        </RouterLink>
        <NavigationMenu :viewport="false">
            <NavigationMenuList class="gap-1">
                <NavigationMenuItem v-for="link in links" :key="link.name">
                    <NavigationMenuLink
                        :active="isActive(link.name)"
                        class="hover:border-border data-active:border-border border border-transparent py-1 font-medium hover:bg-transparent focus:bg-transparent"
                        as-child
                    >
                        <RouterLink :to="{ name: link.name }">
                            <component :is="link.icon" />
                            {{ link.label }}
                        </RouterLink>
                    </NavigationMenuLink>
                </NavigationMenuItem>
            </NavigationMenuList>
        </NavigationMenu>
        <div class="flex-1" />
        <NotificationsBell />
        <UserMenu />
    </header>
</template>
