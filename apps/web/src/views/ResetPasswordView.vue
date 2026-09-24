<script setup lang="ts">
import CodeInput from '@/components/CodeInput.vue';
import FormError from '@/components/FormError.vue';
import ResendCode from '@/components/ResendCode.vue';
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
import { ResetPasswordFormSchema } from '@/lib/auth-schemas';

import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const email = String(route.query.email);

const { submit, formError, isSubmitting, fieldProps } = useAppForm({
    schema: ResetPasswordFormSchema,
    initialValues: { otp: '', password: '', confirmPassword: '' },
    onSubmit: async ({ otp, password }) => {
        const { error } = await emailOtp.resetPassword({
            email,
            otp,
            password,
        });
        if (error) {
            return error.message ?? 'Unable to reset your password.';
        }

        await router.replace({ name: 'sign-in', query: { reset: '1' } });
    },
});

async function resend() {
    const { error } = await emailOtp.requestPasswordReset({ email });
    return error ? (error.message ?? 'Unable to send a new code.') : undefined;
}
</script>

<template>
    <main class="flex min-h-svh items-center justify-center p-4">
        <Card class="w-full max-w-sm">
            <CardHeader>
                <CardTitle>Choose a new password</CardTitle>
                <CardDescription>
                    If {{ email }} has an account, we sent it a reset code.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form class="grid gap-4" novalidate @submit="submit">
                    <FormError :message="formError" />

                    <FormField
                        v-slot="{ componentField }"
                        v-bind="fieldProps"
                        name="otp"
                    >
                        <FormItem>
                            <FormLabel>Reset code</FormLabel>
                            <FormControl>
                                <CodeInput v-bind="componentField" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    </FormField>

                    <FormField
                        v-slot="{ componentField }"
                        v-bind="fieldProps"
                        name="password"
                    >
                        <FormItem>
                            <FormLabel>New password</FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    autocomplete="new-password"
                                    v-bind="componentField"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    </FormField>

                    <FormField
                        v-slot="{ componentField }"
                        v-bind="fieldProps"
                        name="confirmPassword"
                    >
                        <FormItem>
                            <FormLabel>Confirm new password</FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    autocomplete="new-password"
                                    v-bind="componentField"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    </FormField>

                    <Button type="submit" :disabled="isSubmitting">
                        <Spinner v-if="isSubmitting" />
                        Reset password
                    </Button>

                    <ResendCode :send="resend" @error="formError = $event" />
                </form>
            </CardContent>
        </Card>
    </main>
</template>
