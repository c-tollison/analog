<script setup lang="ts">
import { RATING_MAX, RATING_STARS } from '@analog/types';
import { cn } from '@/lib/utils';

import { StarHalfIcon, StarIcon } from '@lucide/vue';
import { SliderRoot, SliderThumb } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

const props = defineProps<{
    readonly?: boolean;
    small?: boolean;
    class?: HTMLAttributes['class'];
}>();

// Counts half stars, from 1 to RATING_MAX.
const rating = defineModel<number | null>({ default: null });

const stars = Array.from({ length: RATING_STARS }, (_, i) => i + 1);

const label = computed(
    () => `${(rating.value ?? 0) / 2} out of ${RATING_STARS} stars`
);

const size = computed(() => {
    if (!props.readonly) return 'size-8';
    return props.small ? 'size-3' : 'size-4';
});

const isFull = (star: number) => (rating.value ?? 0) >= star * 2;
const isHalf = (star: number) => rating.value === star * 2 - 1;

const sliderValue = computed(() => [rating.value ?? 0]);

// Sliding all the way left clears the rating.
function onSlide(value: number[] | undefined) {
    const halves = value?.[0] ?? 0;
    rating.value = halves > 0 ? halves : null;
}
</script>

<!-- Each star has the same width, so the left half of a star is a half
     rating. The half star icon draws over the outline. -->
<template>
    <div
        v-if="readonly"
        role="img"
        :aria-label="label"
        :class="cn('flex gap-0.5', props.class)"
    >
        <div v-for="star in stars" :key="star" class="relative">
            <StarIcon
                :class="cn(
                    size,
                    isFull(star)
                        ? 'fill-primary text-primary'
                        : 'text-muted-foreground'
                )"
            />
            <StarHalfIcon
                v-if="isHalf(star)"
                :class="cn('fill-primary text-primary absolute inset-0', size)"
            />
        </div>
    </div>
    <!-- The drawer swipes closed on a drag, so drags here must not reach
         it. -->
    <div
        v-else
        :class="cn('w-fit', props.class)"
        @pointerdown.stop
        @touchstart.stop
    >
        <SliderRoot
            :model-value="sliderValue"
            :min="0"
            :max="RATING_MAX"
            :step="1"
            thumb-alignment="overflow"
            class="has-focus-visible:ring-ring/30 relative flex cursor-pointer touch-none rounded-md select-none has-focus-visible:ring-2"
            @update:model-value="onSlide"
        >
            <div v-for="star in stars" :key="star" class="relative p-1">
                <StarIcon
                    :class="cn(
                        size,
                        isFull(star)
                            ? 'fill-primary text-primary'
                            : 'text-muted-foreground'
                    )"
                />
                <StarHalfIcon
                    v-if="isHalf(star)"
                    :class="cn('fill-primary text-primary absolute inset-1', size)"
                />
            </div>
            <SliderThumb
                aria-label="Rating"
                :aria-valuetext="label"
                class="size-0 outline-none"
            />
        </SliderRoot>
    </div>
</template>
