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
    {
        name: 'collections',
        label: 'Collections',
        icon: LibraryBigIcon,
        paths: ['/collections'],
    },
    {
        name: 'friends',
        label: 'Friends',
        icon: UsersIcon,
        paths: ['/friends', '/users'],
    },
] as const;

// Nested pages (a collection, a person) keep their section highlighted.
function isActive(paths: readonly string[]) {
    return paths.some((path) => route.path.startsWith(path));
}
</script>

<template>
    <header class="bg-background fixed inset-x-0 top-0 z-50 h-14 border-b">
        <div class="mx-auto flex h-full max-w-5xl items-center gap-2 px-4">
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
                            :active="isActive(link.paths)"
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
        </div>
    </header>
</template>
