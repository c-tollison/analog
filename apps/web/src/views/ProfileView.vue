<script setup lang="ts">
import FormError from '@/components/FormError.vue';
import { AvatarBadge } from '@/components/shadcn-components/avatar';
import { Button } from '@/components/shadcn-components/button';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/shadcn-components/form';
import { Input } from '@/components/shadcn-components/input';
import { Label } from '@/components/shadcn-components/label';
import { Spinner } from '@/components/shadcn-components/spinner';
import AvatarDialog from '@/components/users/AvatarDialog.vue';
import UserAvatar from '@/components/users/UserAvatar.vue';
import { useAppForm } from '@/composables/useAppForm';
import { useUpdateProfile } from '@/composables/useUsers';
import { UpdateProfileSchema } from '@/lib/auth-schemas';
import { vNoAutofill } from '@/lib/no-autofill';
import { useSessionStore } from '@/stores/session';

import { CameraIcon, CheckIcon, ExternalLinkIcon } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';

const { session } = storeToRefs(useSessionStore());
const user = computed(() => session.value?.user);

const update = useUpdateProfile();
const saved = ref(false);
const avatarOpen = ref(false);

const { submit, formError, isSubmitting, fieldProps, resetForm } = useAppForm({
    schema: UpdateProfileSchema,
    initialValues: {
        name: user.value?.name ?? '',
        username: user.value?.username ?? '',
    },
    onSubmit: async (values) => {
        saved.value = false;
        await update.mutateAsync(values);
        resetForm({ values });
        saved.value = true;
        return undefined;
    },
});
</script>

<template>
    <main class="mx-auto flex w-full max-w-lg flex-col gap-6 p-4">
        <div class="flex items-center gap-3">
            <Button
                v-if="user"
                variant="ghost"
                class="size-auto rounded-full p-0"
                aria-label="Change photo"
                @click="avatarOpen = true"
            >
                <UserAvatar :name="user.name" :image="user.image" size="lg">
                    <AvatarBadge
                        class="group-data-[size=lg]/avatar:size-4 group-data-[size=lg]/avatar:[&>svg]:size-2.5"
                    >
                        <CameraIcon />
                    </AvatarBadge>
                </UserAvatar>
            </Button>
            <h1 class="min-w-0 flex-1 truncate text-lg font-semibold">
                Profile
            </h1>
            <Button v-if="user?.username" variant="outline" size="sm" as-child>
                <RouterLink
                    :to="{ name: 'user', params: { username: user.username } }"
                >
                    <ExternalLinkIcon />
                    View public page
                </RouterLink>
            </Button>
        </div>

        <form class="grid gap-4" novalidate @submit="submit">
            <FormError :message="formError" />

            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="name"
            >
                <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                        <Input
                            type="text"
                            autocomplete="name"
                            v-bind="componentField"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>

            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="username"
            >
                <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                        <Input
                            type="text"
                            autocapitalize="none"
                            spellcheck="false"
                            v-no-autofill
                            v-bind="componentField"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </FormField>

            <div class="grid gap-2">
                <Label for="email">Email</Label>
                <Input id="email" :model-value="user?.email" disabled />
            </div>

            <div class="flex items-center gap-3">
                <Button type="submit" :disabled="isSubmitting">
                    <Spinner v-if="isSubmitting" />
                    Save
                </Button>
                <span
                    v-if="saved && !isSubmitting"
                    class="text-muted-foreground flex items-center gap-1 text-sm"
                >
                    <CheckIcon class="size-4" />
                    Saved
                </span>
            </div>
        </form>

        <AvatarDialog
            v-if="user"
            v-model:open="avatarOpen"
            :name="user.name"
            :image="user.image"
        />
    </main>
</template>
