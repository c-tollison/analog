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
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const search = useSearchStore();

// The sliding highlight shows the current tab, so links don't get their own
// background. Phones keep hover after a tap, and closing search hands focus
// back to its button, so those would leave a second tab lit. Keyboard focus
// still shows its ring.
const linkClass =
    'relative w-20 flex-col gap-0.5 rounded-full py-1.5 font-medium hover:bg-transparent focus:bg-transparent data-active:bg-transparent data-active:hover:bg-transparent data-active:focus:bg-transparent';

// Search sits between Shelves and Friends.
const beforeSearch = navLinks.slice(0, 2);
const afterSearch = navLinks.slice(2);

// Where the highlight sits: open search wins, then the page's tab.
const activeIndex = computed(() => {
    if (search.isOpen) return beforeSearch.length;
    const before = beforeSearch.findIndex((link) =>
        isNavActive(route.path, link.paths)
    );
    if (before !== -1) return before;
    const after = afterSearch.findIndex((link) =>
        isNavActive(route.path, link.paths)
    );
    return after === -1 ? -1 : beforeSearch.length + 1 + after;
});

// Each tab is w-20 (5rem) with a gap-1 (0.25rem) after it.
const highlightStyle = computed(() => ({
    transform: `translateX(${Math.max(activeIndex.value, 0) * 5.25}rem)`,
}));
</script>

<template>
    <NavigationMenu
        :viewport="false"
        aria-label="Mobile"
        class="bg-background fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border p-1 shadow-lg md:hidden"
    >
        <span
            aria-hidden="true"
            class="bg-muted pointer-events-none absolute inset-y-1 left-1 w-20 rounded-full ease-out motion-safe:transition-all motion-safe:duration-300"
            :class="{ 'opacity-0': activeIndex === -1 }"
            :style="highlightStyle"
        />
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
