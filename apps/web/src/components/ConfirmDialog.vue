<script setup lang="ts">
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/shadcn-components/alert-dialog';
import {
    Button,
    type ButtonVariants,
} from '@/components/shadcn-components/button';
import { Spinner } from '@/components/shadcn-components/spinner';

withDefaults(
    defineProps<{
        title: string;
        description?: string;
        confirmText?: string;
        variant?: ButtonVariants['variant'];
        pending?: boolean;
    }>(),
    { confirmText: 'Confirm', variant: 'destructive', pending: false }
);

const emit = defineEmits<{ confirm: [] }>();

const open = defineModel<boolean>('open', { default: false });
</script>

<template>
    <AlertDialog v-model:open="open">
        <AlertDialogTrigger v-if="$slots.trigger" as-child>
            <slot name="trigger" />
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{{ title }}</AlertDialogTitle>
                <AlertDialogDescription v-if="description">
                    {{ description }}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel :disabled="pending"
                    >Cancel</AlertDialogCancel
                >
                <Button
                    :variant="variant"
                    :disabled="pending"
                    @click="emit('confirm')"
                >
                    <Spinner v-if="pending" />
                    {{ confirmText }}
                </Button>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
</template>
