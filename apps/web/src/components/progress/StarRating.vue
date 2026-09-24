<script setup lang="ts">
import { RATING_MAX } from '@analog/types';
import { Button } from '@/components/shadcn-components/button';
import { cn } from '@/lib/utils';

import { StarIcon } from '@lucide/vue';
import type { HTMLAttributes } from 'vue';

const props = defineProps<{
    readonly?: boolean;
    small?: boolean;
    class?: HTMLAttributes['class'];
}>();

const rating = defineModel<number | null>({ default: null });

const stars = Array.from({ length: RATING_MAX }, (_, i) => i + 1);

function starClass(star: number, size: string) {
    const filled = rating.value !== null && star <= rating.value;
    return cn(
        size,
        filled ? 'fill-primary text-primary' : 'text-muted-foreground'
    );
}

// Picking the current rating again clears it.
function pick(star: number) {
    rating.value = rating.value === star ? null : star;
}
</script>

<template>
    <div
        v-if="readonly"
        role="img"
        :aria-label="`${rating ?? 0} out of ${RATING_MAX} stars`"
        :class="cn('flex gap-0.5', props.class)"
    >
        <StarIcon
            v-for="star in stars"
            :key="star"
            :class="starClass(star, small ? 'size-3' : 'size-4')"
        />
    </div>
    <div
        v-else
        role="group"
        aria-label="Rating"
        :class="cn('flex', props.class)"
    >
        <Button
            v-for="star in stars"
            :key="star"
            type="button"
            variant="ghost"
            size="icon-lg"
            :aria-label="`${star} ${star === 1 ? 'star' : 'stars'}`"
            :aria-pressed="rating === star"
            @click="pick(star)"
        >
            <StarIcon :class="starClass(star, 'size-6')" />
        </Button>
    </div>
</template>
