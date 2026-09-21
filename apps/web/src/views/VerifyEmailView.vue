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
import { Spinner } from '@/components/shadcn-components/spinner';
import { useAppForm } from '@/composables/useAppForm';
import { emailOtp } from '@/lib/auth';
import { VerifyOtpSchema } from '@/lib/auth-schemas';
import { getRedirect } from '@/lib/redirect';

import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const email = String(route.query.email);

const { submit, formError, isSubmitting, fieldProps } = useAppForm({
    schema: VerifyOtpSchema,
    initialValues: { otp: '' },
    onSubmit: async ({ otp }) => {
        const { error } = await emailOtp.verifyEmail({ email, otp });
        if (error) {
            return error.message ?? 'Unable to verify your email.';
        }

        await router.replace(getRedirect(route.query));
    },
});

async function resend() {
    const { error } = await emailOtp.sendVerificationOtp({
        email,
        type: 'email-verification',
    });
    return error ? (error.message ?? 'Unable to send a new code.') : undefined;
}
</script>

<template>
    <main class="flex min-h-svh items-center justify-center p-4">
        <Card class="w-full max-w-sm">
            <CardHeader>
                <CardTitle>Check your email</CardTitle>
                <CardDescription>
                    We sent a code to {{ email }}. Enter it to confirm your
                    email address.
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
                            <FormLabel>Verification code</FormLabel>
                            <FormControl>
                                <CodeInput
                                    v-bind="componentField"
                                    @complete="submit()"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    </FormField>

                    <Button type="submit" :disabled="isSubmitting">
                        <Spinner v-if="isSubmitting" />
                        Verify email
                    </Button>

                    <ResendCode :send="resend" @error="formError = $event" />

                    <p class="text-muted-foreground text-center text-sm">
                        Wrong email?
                        <RouterLink class="underline" to="/sign-up">
                            Sign up again
                        </RouterLink>
                    </p>
                </form>
            </CardContent>
        </Card>
    </main>
</template>
