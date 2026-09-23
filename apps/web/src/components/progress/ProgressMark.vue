<script setup lang="ts">
import type { ProgressStatus } from '@analog/types';
import StarRating from '@/components/progress/StarRating.vue';
import { Badge } from '@/components/shadcn-components/badge';
import type { StatusLabels } from '@/lib/media-types';

defineProps<{
    status: ProgressStatus | null;
    rating: number | null;
    labels: StatusLabels;
}>();
</script>

<!-- Stars when rated, otherwise the status. The row keeps its height when
     empty so tiles in a grid line up. -->
<template>
    <div class="flex h-5 items-center">
        <StarRating
            v-if="rating !== null"
            readonly
            small
            :model-value="rating"
        />
        <Badge v-else-if="status" variant="outline">
            {{ labels[status] }}
        </Badge>
    </div>
</template>
