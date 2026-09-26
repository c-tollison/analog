<script setup lang="ts">
import { Button } from '@/components/shadcn-components/button';
import { Spinner } from '@/components/shadcn-components/spinner';

// A form's submit button, with "Saved" beside it after the last save worked.
withDefaults(
    defineProps<{ pending: boolean; saved: boolean; label?: string }>(),
    { label: 'Save' }
);
</script>

<template>
    <div class="flex items-center gap-3">
        <Button type="submit" :disabled="pending">
            <Spinner v-if="pending" />
            {{ label }}
        </Button>
        <span v-if="saved" class="text-muted-foreground text-sm">Saved</span>
    </div>
</template>
