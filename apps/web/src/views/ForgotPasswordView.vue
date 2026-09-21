<script setup lang="ts">
import FormError from '@/components/FormError.vue';
import { Button } from '@/components/shadcn-components/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/shadcn-components/card';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/shadcn-components/form';
import { Input } from '@/components/shadcn-components/input';
import { Spinner } from '@/components/shadcn-components/spinner';
import { useAppForm } from '@/composables/useAppForm';
import { emailOtp } from '@/lib/auth';
import { ForgotPasswordSchema } from '@/lib/auth-schemas';

import { useRouter } from 'vue-router';

const router = useRouter();

const { submit, formError, isSubmitting, fieldProps } = useAppForm({
    schema: ForgotPasswordSchema,
    initialValues: { email: '' },
    onSubmit: async ({ email }) => {
        const { error } = await emailOtp.requestPasswordReset({ email });
        if (error) {
            return error.message ?? 'Unable to send a reset code.';
        }

        await router.push({ name: 'reset-password', query: { email } });
    },
});
</script>

<template>
    <main class="flex min-h-svh items-center justify-center p-4">
        <Card class="w-full max-w-sm">
            <CardHeader>
                <CardTitle>Reset your password</CardTitle>
                <CardDescription>
                    Enter your email and we'll send you a code to reset your
                    password.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form class="grid gap-4" novalidate @submit="submit">
                    <FormError :message="formError" />

                    <FormField
                        v-slot="{ componentField }"
                        v-bind="fieldProps"
                        name="email"
                    >
                        <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input
                                    type="email"
                                    autocomplete="email"
                                    placeholder="you@example.com"
                                    v-bind="componentField"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    </FormField>

                    <Button type="submit" :disabled="isSubmitting">
                        <Spinner v-if="isSubmitting" />
                        Send code
                    </Button>

                    <p class="text-muted-foreground text-center text-sm">
                        Remembered it?
                        <RouterLink class="underline" to="/sign-in">
                            Sign in
                        </RouterLink>
                    </p>
                </form>
            </CardContent>
        </Card>
    </main>
</template>
