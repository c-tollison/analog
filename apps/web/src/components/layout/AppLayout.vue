<script setup lang="ts">
import AppBottomNav from './AppBottomNav.vue';
import AppTopNav from './AppTopNav.vue';
</script>

<template>
    <div class="min-h-svh w-full pt-14">
        <AppTopNav />
        <main class="mx-auto w-full max-w-5xl p-4 pb-24 md:pb-4">
            <RouterView />
        </main>
        <AppBottomNav />
    </div>
</template>
