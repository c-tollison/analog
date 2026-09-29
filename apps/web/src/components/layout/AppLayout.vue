<script setup lang="ts">
import AppBottomNav from './AppBottomNav.vue';
import AppTopNav from './AppTopNav.vue';
</script>

<template>
    <div class="min-h-svh w-full pt-14">
        <AppTopNav />
        <main class="mx-auto w-full max-w-5xl p-4 pb-24 md:pb-4">
            <RouterView v-slot="{ Component }">
                <Transition
                    mode="out-in"
                    enter-active-class="motion-safe:animate-in fade-in slide-in-from-bottom-2 animation-duration-300 ease-out"
                >
                    <component :is="Component" />
                </Transition>
            </RouterView>
        </main>
        <AppBottomNav />
    </div>
</template>
