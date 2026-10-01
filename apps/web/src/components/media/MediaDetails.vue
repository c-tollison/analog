<script setup lang="ts">
import ExternalLinks from '@/components/media/ExternalLinks.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import type { AdminItem } from '@/composables/useAdmin';
import type { ItemPage } from '@/composables/useItems';

import { computed, ref } from 'vue';

const LONG_DESCRIPTION = 400;

const props = defineProps<{
    description: ItemPage['description'];
    genres?: string[];
    facts: ItemPage['facts'];
    links?: AdminItem['links'];
}>();

const showFullDescription = ref(false);
const isLongDescription = computed(
    () => (props.description?.length ?? 0) > LONG_DESCRIPTION
);
</script>

<template>
    <div class="grid content-start gap-4">
        <div v-if="description" class="grid justify-items-start gap-1">
            <p
                class="text-sm whitespace-pre-line"
                :class="{
                    'line-clamp-6': isLongDescription && !showFullDescription,
                }"
            >
                {{ description }}
            </p>
            <Button
                v-if="isLongDescription"
                variant="link"
                size="sm"
                class="px-0"
                @click="showFullDescription = !showFullDescription"
            >
                {{ showFullDescription ? 'Show less' : 'Show more' }}
            </Button>
        </div>

        <div v-if="genres?.length" class="flex flex-wrap gap-1.5">
            <Badge v-for="genre in genres" :key="genre" variant="outline">
                {{ genre }}
            </Badge>
        </div>

        <dl
            v-if="facts.length"
            class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"
        >
            <template v-for="fact in facts" :key="fact.label">
                <dt class="text-muted-foreground">{{ fact.label }}</dt>
                <dd>{{ fact.value }}</dd>
            </template>
        </dl>

        <div v-if="links?.length" class="flex flex-wrap gap-2">
            <ExternalLinks :links="links" />
        </div>
    </div>
</template>
