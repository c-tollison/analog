<script setup lang="ts">
import { Alert, AlertDescription } from '@/components/shadcn-components/alert';

import { AlertCircleIcon } from '@lucide/vue';

defineProps<{ message: string | null }>();
</script>

<template>
    <Alert v-if="message" variant="destructive">
        <AlertCircleIcon />
        <AlertDescription>{{ message }}</AlertDescription>
    </Alert>
</template>
