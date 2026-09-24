<script setup lang="ts">
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import FormError from '@/components/FormError.vue';
import { Button } from '@/components/shadcn-components/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/shadcn-components/dialog';
import { Spinner } from '@/components/shadcn-components/spinner';
import AvatarCropper from '@/components/users/AvatarCropper.vue';
import UserAvatar from '@/components/users/UserAvatar.vue';
import { useRemoveAvatar, useUploadAvatar } from '@/composables/useUsers';

import { useFileDialog, useObjectUrl } from '@vueuse/core';
import { computed, ref, shallowRef, watch } from 'vue';

defineProps<{ name: string; image: string | null | undefined }>();

const open = defineModel<boolean>('open', { required: true });

const upload = useUploadAvatar();
const remove = useRemoveAvatar();

const file = shallowRef<File>();
const src = useObjectUrl(file);
const cropper = ref<{ toFile: () => Promise<File> }>();
const readError = ref<string | null>(null);
const confirmRemove = ref(false);

const error = computed(
    () =>
        readError.value ??
        upload.error.value?.message ??
        remove.error.value?.message ??
        null
);

const { open: chooseFile, onChange } = useFileDialog({
    accept: 'image/*',
    multiple: false,
    reset: true,
});

onChange((files) => {
    const chosen = files?.[0];
    if (!chosen) {
        return;
    }
    upload.reset();
    readError.value = null;
    file.value = chosen;
});

function onReadError() {
    file.value = undefined;
    readError.value = "That photo couldn't be opened. Try a JPEG or PNG.";
}

async function save() {
    if (!cropper.value) {
        return;
    }
    readError.value = null;
    let cropped: File;
    try {
        cropped = await cropper.value.toFile();
    } catch {
        readError.value = "That photo couldn't be read. Try another one.";
        return;
    }
    upload.mutate(cropped, {
        onSuccess: () => {
            open.value = false;
        },
    });
}

function onRemove() {
    remove.mutate(undefined, {
        onSuccess: () => {
            open.value = false;
        },
        onSettled: () => {
            confirmRemove.value = false;
        },
    });
}

watch(open, (isOpen) => {
    if (!isOpen) {
        file.value = undefined;
        readError.value = null;
        upload.reset();
        remove.reset();
    }
});
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle>Profile photo</DialogTitle>
                <DialogDescription v-if="src">
                    Drag to position. Zoom with the slider.
                </DialogDescription>
            </DialogHeader>

            <FormError :message="error" />

            <AvatarCropper
                v-if="src"
                ref="cropper"
                :src="src"
                @error="onReadError"
            />
            <UserAvatar
                v-else
                :name="name"
                :image="image"
                class="mx-auto size-32"
            />

            <DialogFooter>
                <template v-if="src">
                    <Button
                        variant="outline"
                        :disabled="upload.isPending.value"
                        @click="chooseFile()"
                    >
                        Choose another
                    </Button>
                    <Button :disabled="upload.isPending.value" @click="save">
                        <Spinner v-if="upload.isPending.value" />
                        Save
                    </Button>
                </template>
                <template v-else>
                    <ConfirmDialog
                        v-if="image"
                        v-model:open="confirmRemove"
                        title="Remove your photo?"
                        confirm-text="Remove"
                        :pending="remove.isPending.value"
                        @confirm="onRemove"
                    >
                        <template #trigger>
                            <Button variant="outline">Remove photo</Button>
                        </template>
                    </ConfirmDialog>
                    <Button @click="chooseFile()">Choose photo</Button>
                </template>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
