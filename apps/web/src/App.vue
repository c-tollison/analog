<script setup lang="ts">
import ModeToggle from './components/ModeToggle.vue';
import { Button } from './components/shadcn-components/button';
import { useApiClient } from './lib/api';
import { ref } from 'vue';

const api = useApiClient();
const message = ref('');

async function fetchMessage() {
    const res = await api['hello-world'].$get();
    message.value = await res.text();
}
</script>

<template>
    <main class="flex min-h-svh flex-col items-center justify-center gap-4">
        <Button @click="fetchMessage">Say hello</Button>
        <p v-if="message">{{ message }}</p>
        <ModeToggle />
    </main>
</template>
