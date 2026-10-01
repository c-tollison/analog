<script setup lang="ts">
import { Button } from '@/components/shadcn-components/button';
import { Kbd } from '@/components/shadcn-components/kbd';
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from '@/components/shadcn-components/navigation-menu';
import { useSearchStore } from '@/stores/search';

import NotificationSummaryTooltip from './NotificationSummaryTooltip.vue';
import NotificationsBell from './NotificationsBell.vue';
import { isNavActive, navLinks } from './nav-links';
import UserMenu from './UserMenu.vue';
import { DiscAlbumIcon, SearchIcon } from '@lucide/vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const search = useSearchStore();
</script>

<template>
    <header
        class="bg-background fixed inset-x-0 top-0 z-50 h-14 border-b pr-(--scrollbar-width)"
    >
        <div class="mx-auto flex h-full max-w-5xl items-center gap-2 px-4">
            <RouterLink
                :to="{ name: 'home' }"
                class="mr-2 flex items-center"
                aria-label="Analog home"
            >
                <!-- TODO: swap for the Analog logo. -->
                <DiscAlbumIcon class="size-6" />
            </RouterLink>
            <NavigationMenu :viewport="false" class="hidden md:flex">
                <NavigationMenuList class="gap-1">
                    <NavigationMenuItem
                        v-for="link in navLinks"
                        :key="link.name"
                    >
                        <NavigationMenuLink
                            :active="isNavActive(route.path, link.paths)"
                            class="hover:border-border data-active:border-border border border-transparent py-1 font-medium hover:bg-transparent focus:bg-transparent data-active:bg-transparent data-active:hover:bg-transparent data-active:focus:bg-transparent"
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
            <div class="flex flex-1 justify-center">
                <Button
                    variant="outline"
                    class="hidden w-full max-w-xs justify-start md:flex"
                    @click="search.isOpen = true"
                >
                    <SearchIcon />
                    Search
                    <Kbd class="ml-auto">⌘K</Kbd>
                </Button>
            </div>
            <Button
                variant="ghost"
                size="icon"
                class="md:hidden"
                aria-label="Search"
                @click="search.isOpen = true"
            >
                <SearchIcon />
            </Button>
            <NotificationSummaryTooltip side="bottom" desktop>
                <NotificationsBell class="hidden md:inline-flex" />
            </NotificationSummaryTooltip>
            <UserMenu />
        </div>
    </header>
</template>
