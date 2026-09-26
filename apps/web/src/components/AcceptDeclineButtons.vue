<script setup lang="ts">
import { Button } from '@/components/shadcn-components/button';
import { Spinner } from '@/components/shadcn-components/spinner';

import { CheckIcon, XIcon } from '@lucide/vue';

// Answers a request or invite. `pending` is the button that shows a spinner.
defineProps<{ disabled: boolean; pending?: 'accept' | 'decline' }>();

const emit = defineEmits<{ accept: []; decline: [] }>();
</script>

<template>
    <Button size="sm" :disabled="disabled" @click="emit('accept')">
        <Spinner v-if="pending === 'accept'" />
        <CheckIcon v-else />
        Accept
    </Button>
    <Button
        size="sm"
        variant="outline"
        :disabled="disabled"
        @click="emit('decline')"
    >
        <Spinner v-if="pending === 'decline'" />
        <XIcon v-else />
        Decline
    </Button>
</template>
