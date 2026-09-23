<script setup lang="ts">
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from '@/components/shadcn-components/avatar';
import { Button } from '@/components/shadcn-components/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/shadcn-components/dropdown-menu';
import { signOut } from '@/lib/auth';
import { useSessionStore } from '@/stores/session';

import {
    ChevronDownIcon,
    LogOutIcon,
    MoonIcon,
    SunIcon,
    UserIcon,
} from '@lucide/vue';
import { useColorMode } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const mode = useColorMode();
const { session } = storeToRefs(useSessionStore());

const user = computed(() => session.value?.user);
const displayName = computed<string>(
    () => user.value?.name || user.value?.email || ''
);
const initials = computed(() =>
    displayName.value
        .split(/[\s@.]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')
);

// 'auto' follows the system, so resolve it before flipping.
const isDark = computed(
    () => (mode.value === 'auto' ? mode.system.value : mode.value) === 'dark'
);

function toggleTheme() {
    mode.value = isDark.value ? 'light' : 'dark';
}

async function onSignOut() {
    await signOut();
    await router.replace({ name: 'sign-in' });
}
</script>

<template>
    <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <Button variant="ghost" class="h-9 gap-2 px-2">
                <Avatar class="size-7">
                    <AvatarImage
                        v-if="user?.image"
                        :src="user.image"
                        :alt="displayName"
                    />
                    <AvatarFallback class="text-xs">
                        {{ initials }}
                    </AvatarFallback>
                </Avatar>
                <span class="hidden text-sm font-medium md:block">
                    {{ displayName }}
                </span>
                <ChevronDownIcon class="text-muted-foreground size-4" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuLabel class="flex flex-col">
                <span class="text-foreground truncate text-sm font-medium">
                    {{ displayName }}
                </span>
                <span class="text-muted-foreground truncate text-xs">
                    {{ user?.email }}
                </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="router.push({ name: 'profile' })">
                <UserIcon />
                Profile
            </DropdownMenuItem>
            <DropdownMenuItem @select="toggleTheme">
                <SunIcon v-if="isDark" />
                <MoonIcon v-else />
                {{ isDark ? 'Light mode' : 'Dark mode' }}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="onSignOut">
                <LogOutIcon />
                Sign out
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
</template>
