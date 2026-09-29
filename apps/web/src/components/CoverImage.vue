<script setup lang="ts">
import { type CoverSize, coverSources } from '@/lib/covers';
import { cn } from '@/lib/utils';

import { BookIcon } from '@lucide/vue';
import { computed, type HTMLAttributes, ref, watch } from 'vue';

const props = defineProps<{
    src: string | null;
    alt: string;
    size: CoverSize;
    class?: HTMLAttributes['class'];
}>();

const sources = computed(() =>
    props.src ? coverSources(props.src, props.size) : null
);

const failed = ref(false);
const loaded = ref(false);
watch(
    () => props.src,
    () => {
        failed.value = false;
        loaded.value = false;
    }
);
</script>

<!-- The muted box shows while the cover loads, then the cover fades in over
it. -->
<template>
    <div
        v-if="sources && !failed"
        :class="cn('bg-muted overflow-hidden rounded-sm', props.class)"
    >
        <img
            :src="sources.src"
            :srcset="sources.srcset"
            :alt="alt"
            loading="lazy"
            class="size-full object-cover transition-opacity duration-500 ease-out"
            :class="{ 'opacity-0': !loaded }"
            @load="loaded = true"
            @error="failed = true"
        />
    </div>
    <div
        v-else
        role="img"
        :aria-label="alt"
        :class="
            cn(
                'bg-muted flex items-center justify-center rounded-sm',
                props.class
            )
        "
    >
        <BookIcon class="text-muted-foreground size-6" />
    </div>
</template>
