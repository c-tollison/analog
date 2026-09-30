<script setup lang="ts">
import CheckHint from '@/components/admin/CheckHint.vue';
import FormError from '@/components/FormError.vue';
import {
    type AdminCheck,
    useAcceptCheck,
    useDismissCheck,
} from '@/composables/useAdmin';

import { computed } from 'vue';

defineProps<{ checks: AdminCheck[] }>();

const accept = useAcceptCheck();
const dismiss = useDismissCheck();
const busy = computed(() => accept.isPending.value || dismiss.isPending.value);

function pendingFor(check: AdminCheck) {
    if (accept.isPending.value && accept.variables.value === check.id) {
        return 'accept';
    }
    if (dismiss.isPending.value && dismiss.variables.value === check.id) {
        return 'dismiss';
    }
    return null;
}

const error = computed(
    () => accept.error.value?.message ?? dismiss.error.value?.message ?? null
);
</script>

<!-- A book's or series' suggestions, each with Accept and Dismiss. -->
<template>
    <div v-if="checks.length" class="grid gap-2">
        <FormError :message="error" />
        <CheckHint
            v-for="check in checks"
            :key="check.id"
            :check="check"
            :disabled="busy"
            :pending="pendingFor(check)"
            @accept="accept.mutate(check.id)"
            @dismiss="dismiss.mutate(check.id)"
        />
    </div>
</template>
