<script setup lang="ts">
import { TooltipProvider } from '@/components/shadcn-components/tooltip';

import { useColorMode } from '@vueuse/core';

useColorMode();
</script>

<template>
    <TooltipProvider>
        <RouterView />
    </TooltipProvider>
</template>
