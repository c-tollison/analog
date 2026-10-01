<script setup lang="ts">
import StarRating from '@/components/progress/StarRating.vue';

defineProps<{ rating: number }>();
</script>

<!-- A strip of stars across the bottom of a cover. Goes in CoverImage's
     slot. -->
<template>
    <div
        class="bg-background/80 absolute inset-x-0 bottom-0 flex justify-center py-1 backdrop-blur-sm"
    >
        <StarRating readonly small :model-value="rating" />
    </div>
</template>
