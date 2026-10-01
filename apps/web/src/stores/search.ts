import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Whether search and its Add by ISBN dialog are open, so the nav, shortcuts
 * and dialogs share them.
 */
export const useSearchStore = defineStore('search', () => {
    const isOpen = ref(false);
    const isAddOpen = ref(false);

    function openAdd() {
        isOpen.value = false;
        isAddOpen.value = true;
    }

    return { isOpen, isAddOpen, openAdd };
});
