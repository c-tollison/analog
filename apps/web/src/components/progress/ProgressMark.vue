<script setup lang="ts">
import type { ProgressStatus } from '@analog/types';
import { Badge } from '@/components/shadcn-components/badge';
import { STATUS_LABELS } from '@/lib/book-labels';

defineProps<{
    status: ProgressStatus | null;
    rating: number | null;
}>();
</script>

<!-- The status, unless rated. Ratings show on the cover with CoverRating.
     The row keeps its height when empty so tiles in a grid line up. -->
<template>
    <div class="flex h-5 items-center">
        <Badge v-if="rating === null && status" variant="outline">
            {{ STATUS_LABELS[status] }}
        </Badge>
    </div>
</template>
