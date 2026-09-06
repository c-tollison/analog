<script setup lang="ts">
import ModeToggle from './components/ModeToggle.vue';
import { Button } from './components/shadcn-components/button';

const helloWorld = 'Hello world';
</script>

<template>
    <main class="flex min-h-svh flex-col items-center justify-center gap-4">
        <Button>{{ helloWorld }}</Button>
        <ModeToggle />
    </main>
</template>
