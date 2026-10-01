<script setup lang="ts">
import ConfirmDialog from '@/components/ConfirmDialog.vue';
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
import { Separator } from '@/components/shadcn-components/separator';
import { Spinner } from '@/components/shadcn-components/spinner';
import { Switch } from '@/components/shadcn-components/switch';
import AvatarDialog from '@/components/users/AvatarDialog.vue';
import UserAvatar from '@/components/users/UserAvatar.vue';
import { useAppForm } from '@/composables/useAppForm';
import { useUpdatePreferences, useUpdateProfile } from '@/composables/useUsers';
import { UpdateProfileSchema } from '@/lib/auth-schemas';
import { vNoAutofill } from '@/lib/no-autofill';
import { useSessionStore } from '@/stores/session';

import { ArrowLeftIcon, CameraIcon, CheckIcon } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';

const { session } = storeToRefs(useSessionStore());
const user = computed(() => session.value?.user);

const update = useUpdateProfile();
const saved = ref(false);
const avatarOpen = ref(false);

const preferences = useUpdatePreferences();
const confirmingPublic = ref(false);

// Follows the switch while the save is in flight.
const isPublic = computed(
    () =>
        (preferences.isPending.value
            ? preferences.variables.value?.isPublic
            : undefined) ??
        user.value?.isPublic ??
        false
);

// Going public asks first; going private doesn't.
function onPublicChange(value: boolean) {
    if (value) {
        confirmingPublic.value = true;
    } else {
        preferences.mutate({ isPublic: false });
    }
}

function onConfirmPublic() {
    preferences.mutate(
        { isPublic: true },
        { onSettled: () => (confirmingPublic.value = false) }
    );
}

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
    <div class="mx-auto flex w-full max-w-lg flex-col gap-6">
        <!-- A link, not history back: the username may have just changed. -->
        <div v-if="user?.username">
            <Button variant="ghost" size="sm" class="-ml-2" as-child>
                <RouterLink
                    :to="{ name: 'user', params: { username: user.username } }"
                >
                    <ArrowLeftIcon />
                    Profile
                </RouterLink>
            </Button>
        </div>

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
                Edit profile
            </h1>
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

        <Separator />

        <div class="grid gap-2">
            <FormError :message="preferences.error.value?.message ?? null" />
            <div class="flex items-center justify-between gap-4">
                <div class="grid gap-1">
                    <Label for="public-profile">Public profile</Label>
                    <p class="text-muted-foreground text-sm">
                        {{
                            isPublic
                                ? 'Anyone on Analog can see your public shelves.'
                                : 'Only your friends can see your public shelves.'
                        }}
                    </p>
                </div>
                <Switch
                    id="public-profile"
                    :model-value="isPublic"
                    :disabled="preferences.isPending.value"
                    @update:model-value="onPublicChange"
                />
            </div>
        </div>

        <ConfirmDialog
            v-model:open="confirmingPublic"
            title="Make your profile public?"
            description="Anyone on Analog will be able to see your public shelves."
            confirm-text="Make public"
            variant="default"
            :pending="preferences.isPending.value"
            @confirm="onConfirmPublic"
        />

        <AvatarDialog
            v-if="user"
            v-model:open="avatarOpen"
            :name="user.name"
            :image="user.image"
        />
    </div>
</template>
