<script setup lang="ts">
import ReviewForm from '@/components/progress/ReviewForm.vue';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/shadcn-components/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from '@/components/shadcn-components/drawer';

import { useMediaQuery } from '@vueuse/core';
import { computed } from 'vue';

const props = defineProps<{
    catalogItemId: string;
    title: string;
    rating: number | null;
    review: string | null;
    completedAt: string | null;
}>();

const open = defineModel<boolean>('open', { required: true });

// A dialog on wide screens, a sheet from the bottom on phones.
const isDesktop = useMediaQuery('(min-width: 40rem)');

const cancelText = computed(() =>
    props.rating !== null || props.review ? 'Cancel' : 'Skip'
);
</script>

<template>
    <Dialog v-if="isDesktop" v-model:open="open">
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Your review</DialogTitle>
                <DialogDescription>{{ title }}</DialogDescription>
            </DialogHeader>
            <ReviewForm
                :catalog-item-id="catalogItemId"
                :rating="rating"
                :review="review"
                :completed-at="completedAt"
                :cancel-text="cancelText"
                @done="open = false"
            />
        </DialogContent>
    </Dialog>
    <Drawer v-else v-model:open="open">
        <DrawerContent>
            <DrawerHeader>
                <DrawerTitle>Your review</DrawerTitle>
                <DrawerDescription>{{ title }}</DrawerDescription>
            </DrawerHeader>
            <ReviewForm
                class="px-4 pb-4"
                :catalog-item-id="catalogItemId"
                :rating="rating"
                :review="review"
                :completed-at="completedAt"
                :cancel-text="cancelText"
                @done="open = false"
            />
        </DrawerContent>
    </Drawer>
</template>
