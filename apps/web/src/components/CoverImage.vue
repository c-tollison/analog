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
watch(
    () => props.src,
    () => {
        failed.value = false;
    }
);
</script>

<template>
    <img
        v-if="sources && !failed"
        :src="sources.src"
        :srcset="sources.srcset"
        :alt="alt"
        loading="lazy"
        :class="cn('bg-muted rounded-sm object-cover', props.class)"
        @error="failed = true"
    />
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
