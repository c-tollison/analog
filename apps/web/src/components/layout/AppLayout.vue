<script setup lang="ts">
import AppTopNav from './AppTopNav.vue';
</script>

<template>
    <div class="min-h-svh w-full pt-14">
        <AppTopNav />
        <main class="mx-auto w-full max-w-5xl p-4">
            <RouterView />
        </main>
    </div>
</template>
