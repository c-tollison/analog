<script setup lang="ts">
import { Button } from '@/components/shadcn-components/button';

import { MoonIcon, SunIcon } from '@lucide/vue';
import { useColorMode } from '@vueuse/core';

// Defaults to 'auto' (follow the system). The first press flips away from
// whatever is currently on screen, then it just toggles light <-> dark.
const mode = useColorMode();

function toggle() {
    const current = mode.value === 'auto' ? mode.system.value : mode.value;
    mode.value = current === 'dark' ? 'light' : 'dark';
}
</script>

<template>
    <Button variant="outline" size="icon" @click="toggle">
        <SunIcon
            class="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
        />
        <MoonIcon
            class="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
        />
        <span class="sr-only">Toggle theme</span>
    </Button>
</template>
