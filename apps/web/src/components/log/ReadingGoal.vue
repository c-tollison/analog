<script setup lang="ts">
import ReadingGoalDialog from '@/components/log/ReadingGoalDialog.vue';
import { Button } from '@/components/shadcn-components/button';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/shadcn-components/card';
import { Progress } from '@/components/shadcn-components/progress';
import type { LogStats } from '@/composables/useLog';

import { PencilIcon, TargetIcon } from '@lucide/vue';
import { computed, ref } from 'vue';

const props = defineProps<{ stats: LogStats; isMe: boolean }>();

const isEditing = ref(false);

const percent = computed(() =>
    props.stats.goal
        ? Math.min(
              100,
              Math.round((props.stats.readThisYear / props.stats.goal) * 100)
          )
        : 0
);

// Where you'd be if you read at an even pace all year.
const pace = computed(() => {
    const { goal, year, readThisYear } = props.stats;
    if (!goal) return null;
    if (readThisYear >= goal) return 'Goal reached';
    const now = new Date();
    if (now.getFullYear() !== year) return null;
    const start = new Date(year, 0, 1).getTime();
    const end = new Date(year + 1, 0, 1).getTime();
    const expected = Math.round(
        ((now.getTime() - start) / (end - start)) * goal
    );
    const diff = readThisYear - expected;
    if (diff === 0) return 'On track';
    return diff > 0 ? `${diff} ahead of schedule` : `${-diff} behind schedule`;
});
</script>

<template>
    <Card>
        <CardHeader>
            <CardTitle>{{ stats.year }} goal</CardTitle>
            <CardDescription v-if="stats.goal">
                {{ stats.readThisYear }} of {{ stats.goal }}
                <template v-if="pace">· {{ pace }}</template>
            </CardDescription>
            <CardAction v-if="isMe && stats.goal">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit goal"
                    @click="isEditing = true"
                >
                    <PencilIcon />
                </Button>
            </CardAction>
        </CardHeader>
        <CardContent class="grid gap-2">
            <template v-if="stats.goal">
                <div class="flex items-center gap-3">
                    <Progress :model-value="percent" class="h-2" />
                    <span class="text-muted-foreground text-xs tabular-nums">
                        {{ percent }}%
                    </span>
                </div>
            </template>
            <Button
                v-else-if="isMe"
                variant="outline"
                class="justify-self-start"
                @click="isEditing = true"
            >
                <TargetIcon />
                Set a goal for {{ stats.year }}
            </Button>
            <p v-else class="text-muted-foreground text-xs">No goal set.</p>
        </CardContent>
    </Card>

    <ReadingGoalDialog
        v-if="isMe"
        v-model:open="isEditing"
        :year="stats.year"
        :target="stats.goal"
    />
</template>
