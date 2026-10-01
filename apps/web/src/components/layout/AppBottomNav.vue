<script setup lang="ts">
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from '@/components/shadcn-components/navigation-menu';
import { useSearchStore } from '@/stores/search';

import { isNavActive, navLinks } from './nav-links';
import { SearchIcon } from '@lucide/vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const search = useSearchStore();

const linkClass =
    'relative w-20 flex-col gap-0.5 rounded-full py-1.5 font-medium';

// Search sits between Log and Friends.
const beforeSearch = navLinks.slice(0, 2);
const afterSearch = navLinks.slice(2);
</script>

<template>
    <NavigationMenu
        :viewport="false"
        aria-label="Mobile"
        class="bg-background fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border p-1 shadow-lg md:hidden"
    >
        <NavigationMenuList class="gap-1">
            <NavigationMenuItem v-for="link in beforeSearch" :key="link.name">
                <NavigationMenuLink
                    :active="isNavActive(route.path, link.paths)"
                    :class="linkClass"
                    as-child
                >
                    <RouterLink :to="{ name: link.name }">
                        <component :is="link.icon" class="size-5" />
                        {{ link.label }}
                    </RouterLink>
                </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
                <NavigationMenuLink
                    :active="search.isOpen"
                    :class="linkClass"
                    as-child
                >
                    <button type="button" @click="search.isOpen = true">
                        <SearchIcon class="size-5" />
                        Search
                    </button>
                </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem v-for="link in afterSearch" :key="link.name">
                <NavigationMenuLink
                    :active="isNavActive(route.path, link.paths)"
                    :class="linkClass"
                    as-child
                >
                    <RouterLink :to="{ name: link.name }">
                        <component :is="link.icon" class="size-5" />
                        {{ link.label }}
                    </RouterLink>
                </NavigationMenuLink>
            </NavigationMenuItem>
        </NavigationMenuList>
    </NavigationMenu>
</template>
