<script setup lang="ts">
import LogLists from '@/components/log/LogLists.vue';
import { useSessionStore } from '@/stores/session';

import { storeToRefs } from 'pinia';

const { session } = storeToRefs(useSessionStore());
</script>

<template>
    <div class="flex flex-col gap-4">
        <h1 class="text-lg font-semibold">Log</h1>
        <LogLists
            v-if="session"
            :username="session.user.username"
            :is-me="true"
        />
    </div>
</template>
