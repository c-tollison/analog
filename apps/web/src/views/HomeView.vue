<script setup lang="ts">
import FormError from '@/components/FormError.vue';
import ModeToggle from '@/components/ModeToggle.vue';
import { Button } from '@/components/shadcn-components/button';
import { Spinner } from '@/components/shadcn-components/spinner';
import { useHelloWorld } from '@/composables/useHelloWorld';
import { signOut } from '@/lib/auth';
import { useSessionStore } from '@/stores/session';

import { storeToRefs } from 'pinia';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const { session } = storeToRefs(useSessionStore());
const wantsHello = ref(false);

const {
    data: message,
    isFetching: isFetchingMessage,
    error: messageError,
} = useHelloWorld('Analog', wantsHello);

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

        <Button :disabled="isFetchingMessage" @click="wantsHello = true">
            <Spinner v-if="isFetchingMessage" />
            Say hello
        </Button>
        <p v-if="message">{{ message }}</p>
        <FormError :message="messageError?.message ?? null" />

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
