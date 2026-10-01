<script setup lang="ts">
import LogLists from '@/components/log/LogLists.vue';
import { useSessionStore } from '@/stores/session';

import { storeToRefs } from 'pinia';

const { session } = storeToRefs(useSessionStore());
</script>

<template>
    <div class="flex flex-col gap-4">
        <div class="grid gap-0.5">
            <h1 class="text-lg font-semibold">Log</h1>
            <p class="text-muted-foreground text-sm">
                Keep track of where you are with what you're reading, along with
                your ratings and reviews.
            </p>
        </div>
        <LogLists
            v-if="session"
            :username="session.user.username"
            :is-me="true"
        />
    </div>
</template>
