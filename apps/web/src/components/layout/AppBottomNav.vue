<script setup lang="ts">
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from '@/components/shadcn-components/navigation-menu';

import NotificationCountBadge from './NotificationCountBadge.vue';
import { isNavActive, navLinks } from './nav-links';
import { BellIcon } from '@lucide/vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const links = [
    ...navLinks,
    {
        name: 'notifications',
        label: 'Notifications',
        icon: BellIcon,
        paths: ['/notifications'],
    },
] as const;
</script>

<template>
    <NavigationMenu
        :viewport="false"
        aria-label="Mobile"
        class="bg-background fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border p-1 shadow-lg md:hidden"
    >
        <NavigationMenuList class="gap-1">
            <NavigationMenuItem v-for="link in links" :key="link.name">
                <NavigationMenuLink
                    :active="isNavActive(route.path, link.paths)"
                    class="relative w-24 flex-col gap-0.5 rounded-full py-1.5 font-medium"
                    as-child
                >
                    <RouterLink :to="{ name: link.name }">
                        <component :is="link.icon" class="size-5" />
                        {{ link.label }}
                        <NotificationCountBadge
                            v-if="link.name === 'notifications'"
                            class="top-0.5 right-6"
                        />
                    </RouterLink>
                </NavigationMenuLink>
            </NavigationMenuItem>
        </NavigationMenuList>
    </NavigationMenu>
</template>
