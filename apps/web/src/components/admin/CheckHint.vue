<script setup lang="ts">
import { ACCEPTABLE_RULES, CHECK_RULES } from '@analog/types';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import { Spinner } from '@/components/shadcn-components/spinner';
import type { AdminCheck } from '@/composables/useAdmin';

import { SparklesIcon } from '@lucide/vue';
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        check: AdminCheck;
        disabled: boolean;
        // The button whose request is running.
        pending: 'accept' | 'dismiss' | null;
        // Shows Use, which fills the fix into a form field, in place of
        // Accept. `used` is true once the field already has it.
        fillable?: boolean;
        used?: boolean;
    }>(),
    { fillable: false, used: false }
);

const emit = defineEmits<{ use: []; accept: []; dismiss: [] }>();

const rule = computed(() => CHECK_RULES[props.check.rule]);
const canAccept = computed(
    () =>
        props.check.fix !== null && ACCEPTABLE_RULES.includes(props.check.rule)
);
const sure = computed(() =>
    props.check.confidence === null
        ? null
        : `${Math.round(props.check.confidence * 100)}% sure`
);
</script>

<!-- One suggestion from `pnpm catalog:check`, on one line. -->
<template>
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <SparklesIcon class="text-muted-foreground size-3.5 shrink-0" />
        <span class="text-muted-foreground">{{ rule.label }}:</span>
        <span class="min-w-0 break-words">{{ check.message }}</span>
        <Badge v-if="sure" variant="secondary">{{ sure }}</Badge>
        <Button
            v-if="fillable"
            type="button"
            size="sm"
            variant="outline"
            :disabled="disabled || used"
            @click="emit('use')"
        >
            {{ used ? 'Used' : 'Use' }}
        </Button>
        <Button
            v-else-if="canAccept"
            type="button"
            size="sm"
            :disabled="disabled"
            @click="emit('accept')"
        >
            <Spinner v-if="pending === 'accept'" />
            Accept
        </Button>
        <Button
            type="button"
            size="sm"
            variant="ghost"
            :disabled="disabled"
            @click="emit('dismiss')"
        >
            <Spinner v-if="pending === 'dismiss'" />
            Dismiss
        </Button>
    </div>
</template>
