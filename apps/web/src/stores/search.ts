import { useSessionStore } from '@/stores/session';

import { StorageSerializers, useLocalStorage } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { z } from 'zod';

const RECENT_LIMIT = 6;
const RECENT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const RecentSearchesSchema = z.array(
    z.object({ term: z.string(), at: z.number() })
);

/**
 * Whether search and its Add by ISBN dialog are open, so the nav, shortcuts
 * and dialogs share them. Also keeps each person's recent searches in this
 * browser for a few days.
 */
export const useSearchStore = defineStore('search', () => {
    const isOpen = ref(false);
    const isAddOpen = ref(false);

    function openAdd() {
        isOpen.value = false;
        isAddOpen.value = true;
    }

    const session = useSessionStore();
    const stored = useLocalStorage<unknown>(
        () => `analog:recent-searches:${session.session?.user.id ?? ''}`,
        [],
        { serializer: StorageSerializers.object }
    );

    const recent = computed(() => {
        const parsed = RecentSearchesSchema.safeParse(stored.value);
        return parsed.success ? parsed.data : [];
    });

    function fresh() {
        const since = Date.now() - RECENT_TTL_MS;
        return recent.value.filter((entry) => entry.at > since);
    }

    /** Drops searches older than a few days. */
    function pruneRecent() {
        const kept = fresh();
        if (kept.length !== recent.value.length) stored.value = kept;
    }

    /** Moves `term` to the top of the recent searches. */
    function remember(term: string) {
        const key = term.toLowerCase();
        stored.value = [
            { term, at: Date.now() },
            ...fresh().filter((entry) => entry.term.toLowerCase() !== key),
        ].slice(0, RECENT_LIMIT);
    }

    function clearRecent() {
        stored.value = [];
    }

    return {
        isOpen,
        isAddOpen,
        openAdd,
        recent,
        pruneRecent,
        remember,
        clearRecent,
    };
});
