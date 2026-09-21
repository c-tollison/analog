<script setup lang="ts">
import ModeToggle from '@/components/ModeToggle.vue';
import { Button } from '@/components/shadcn-components/button';
import { useApiClient } from '@/lib/api';
import { signOut, useSession } from '@/lib/auth';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

const api = useApiClient();
const router = useRouter();
const session = useSession();
const message = ref('');

async function fetchMessage() {
    const res = await api['hello-world'].$get({ query: { name: 'Analog' } });
    message.value = await res.text();
}

async function handleSignOut() {
    await signOut();
    await router.replace({ name: 'sign-in' });
}
</script>

<template>
    <main class="flex min-h-svh flex-col items-center justify-center gap-4">
        <p v-if="session.data" class="text-muted-foreground text-sm">
            Signed in as {{ session.data.user.email }}
        </p>

        <Button @click="fetchMessage">Say hello</Button>
        <p v-if="message">{{ message }}</p>

        <div class="flex items-center gap-2">
            <ModeToggle />
            <Button variant="outline" @click="handleSignOut">Sign out</Button>
        </div>
    </main>
</template>
