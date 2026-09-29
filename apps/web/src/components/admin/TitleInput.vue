<script setup lang="ts">
import { Textarea } from '@/components/shadcn-components/textarea';
import { vNoAutofill } from '@/lib/no-autofill';

// A title box that wraps long titles onto more lines. Enter leaves the box
// instead of starting a new line.
function blurOnEnter(event: KeyboardEvent) {
    if (event.target instanceof HTMLElement) event.target.blur();
}
</script>

<template>
    <Textarea
        v-no-autofill
        rows="1"
        class="min-h-7 py-1"
        @keydown.enter.prevent="blurOnEnter"
    />
</template>
