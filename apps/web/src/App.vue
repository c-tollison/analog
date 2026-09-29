<script setup lang="ts">
import { TooltipProvider } from '@/components/shadcn-components/tooltip';
import { usePageTitle } from '@/composables/usePageTitle';

import { useColorMode } from '@vueuse/core';

useColorMode();
usePageTitle();
</script>

<template>
    <TooltipProvider>
        <RouterView />
    </TooltipProvider>
</template>
