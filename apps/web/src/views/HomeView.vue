<script setup lang="ts">
import ModeToggle from '@/components/ModeToggle.vue';
import { Button } from '@/components/shadcn-components/button';
import { signOut } from '@/lib/auth';
import { useSessionStore } from '@/stores/session';

import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';

const router = useRouter();
const { session } = storeToRefs(useSessionStore());

async function handleSignOut() {
    await signOut();
    await router.replace({ name: 'sign-in' });
}
</script>

<template>
    <main class="flex min-h-svh flex-col items-center justify-center gap-4">
        <p v-if="session" class="text-muted-foreground text-sm">
            Signed in as {{ session.user.email }}
        </p>

        <div class="flex items-center gap-2">
            <Button as-child>
                <RouterLink :to="{ name: 'scan' }">Scan</RouterLink>
            </Button>
            <Button variant="outline" as-child>
                <RouterLink :to="{ name: 'collections' }">
                    Collections
                </RouterLink>
            </Button>
        </div>

        <div class="flex items-center gap-2">
            <ModeToggle />
            <Button variant="outline" @click="handleSignOut">Sign out</Button>
        </div>
    </main>
</template>
