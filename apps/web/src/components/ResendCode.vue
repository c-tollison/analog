<script setup lang="ts">
import { Button } from '@/components/shadcn-components/button';

import { useIntervalFn } from '@vueuse/core';
import { ref } from 'vue';

const COOLDOWN_SECONDS = 30;

const props = defineProps<{
    send: () => Promise<string | undefined>;
}>();

const emit = defineEmits<{ error: [message: string] }>();

const secondsLeft = ref(COOLDOWN_SECONDS);
const isSending = ref(false);

const { resume } = useIntervalFn(() => {
    if (secondsLeft.value > 0) {
        secondsLeft.value -= 1;
    }
}, 1000);

async function resend() {
    isSending.value = true;
    try {
        const message = await props.send();
        if (message) {
            emit('error', message);
            return;
        }
        secondsLeft.value = COOLDOWN_SECONDS;
        resume();
    } finally {
        isSending.value = false;
    }
}
</script>

<template>
    <p class="text-muted-foreground text-center text-sm">
        Didn't get a code?
        <Button
            type="button"
            variant="link"
            class="h-auto p-0"
            :disabled="secondsLeft > 0 || isSending"
            @click="resend"
        >
            {{ secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend' }}
        </Button>
    </p>
</template>
