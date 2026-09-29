<script setup lang="ts">
import { Button } from '@/components/shadcn-components/button';
import type { AdminItem } from '@/composables/useAdmin';

import { ExternalLinkIcon } from '@lucide/vue';

defineProps<{ links: AdminItem['links'] }>();
</script>

<template>
    <Button
        v-for="link in links"
        :key="link.url"
        variant="outline"
        size="sm"
        as-child
    >
        <a :href="link.url" target="_blank" rel="noopener noreferrer">
            {{ link.label }}
            <ExternalLinkIcon data-icon="inline-end" />
        </a>
    </Button>
</template>
