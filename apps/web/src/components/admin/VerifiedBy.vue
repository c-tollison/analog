<script setup lang="ts">
import { timeAgo } from '@/lib/dates';

import { BadgeCheckIcon } from '@lucide/vue';

defineProps<{ verifiedAt: string; verifiedBy: string | null }>();
</script>

<template>
    <p class="text-muted-foreground flex items-center gap-1.5 text-xs">
        <BadgeCheckIcon class="size-3.5 shrink-0" />
        Verified by {{ verifiedBy ?? 'a deleted user' }},
        {{ timeAgo(verifiedAt) }}
    </p>
</template>
