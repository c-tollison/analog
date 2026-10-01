<script setup lang="ts">
import { TooltipProvider } from '@/components/shadcn-components/tooltip';
import { usePageTitle } from '@/composables/usePageTitle';
import { pageEntered } from '@/lib/scroll';

import { useColorMode } from '@vueuse/core';

useColorMode();
usePageTitle();
</script>

<template>
    <TooltipProvider>
        <RouterView v-slot="{ Component }">
            <Transition
                mode="out-in"
                @enter="pageEntered"
                enter-active-class="motion-safe:animate-in fade-in animation-duration-300"
            >
                <component :is="Component" />
            </Transition>
        </RouterView>
    </TooltipProvider>
</template>
