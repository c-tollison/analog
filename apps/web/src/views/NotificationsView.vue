<script setup lang="ts">
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from '@/components/shadcn-components/empty';
</script>

<template>
    <main class="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
        <Empty>
            <EmptyHeader>
                <EmptyTitle>Notifications</EmptyTitle>
                <EmptyDescription>Coming soon.</EmptyDescription>
            </EmptyHeader>
        </Empty>
    </main>
</template>
