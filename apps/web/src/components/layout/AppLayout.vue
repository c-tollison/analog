<script setup lang="ts">
import AddByIsbnDialog from '@/components/search/AddByIsbnDialog.vue';
import SearchDialog from '@/components/search/SearchDialog.vue';
import { isRestoredPage } from '@/lib/navigation';
import { pageEntered } from '@/lib/scroll';
import { useSearchStore } from '@/stores/search';

import AppBottomNav from './AppBottomNav.vue';
import AppTopNav from './AppTopNav.vue';
import { onKeyStroke } from '@vueuse/core';
import { storeToRefs } from 'pinia';

const { isOpen: isSearchOpen, isAddOpen } = storeToRefs(useSearchStore());

// Cmd+K or Ctrl+K opens search from anywhere.
onKeyStroke('k', (event) => {
    if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        isSearchOpen.value = true;
    }
});
</script>

<template>
    <div class="min-h-svh w-full pt-14">
        <AppTopNav />
        <main class="mx-auto w-full max-w-5xl p-4 pb-28 md:pb-4">
            <RouterView v-slot="{ Component }">
                <Transition
                    mode="out-in"
                    @enter="pageEntered"
                    :enter-active-class="
                        isRestoredPage
                            ? ''
                            : 'motion-safe:animate-in fade-in slide-in-from-bottom-2 animation-duration-300 ease-out'
                    "
                >
                    <component
                        :is="Component"
                        :class="{
                            '[&_*]:animate-none! [&_img]:transition-none!':
                                isRestoredPage,
                        }"
                    />
                </Transition>
            </RouterView>
        </main>
        <AppBottomNav />
        <SearchDialog />
        <AddByIsbnDialog v-model:open="isAddOpen" />
    </div>
</template>
