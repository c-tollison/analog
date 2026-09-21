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
import { Checkbox } from '@/components/shadcn-components/checkbox';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/shadcn-components/form';
import { Label } from '@/components/shadcn-components/label';
import { Spinner } from '@/components/shadcn-components/spinner';
import { useAppForm } from '@/composables/useAppForm';
import { twoFactor } from '@/lib/auth';
import { VerifyOtpSchema } from '@/lib/auth-schemas';
import { getRedirect } from '@/lib/redirect';

import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const trustDevice = ref(false);

const { submit, formError, isSubmitting, fieldProps } = useAppForm({
    schema: VerifyOtpSchema,
    initialValues: { otp: '' },
    onSubmit: async ({ otp }) => {
        const { error } = await twoFactor.verifyOtp({
            code: otp,
            trustDevice: trustDevice.value,
        });
        if (error) {
            return error.message ?? 'Unable to verify the code.';
        }

        await router.replace(getRedirect(route.query));
    },
});

async function sendCode() {
    const { error } = await twoFactor.sendOtp();
    if (!error) {
        return undefined;
    }
    return error.status === 401
        ? 'Your sign-in has expired. Go back and sign in again.'
        : (error.message ?? 'Unable to send a code.');
}

onMounted(async () => {
    formError.value = (await sendCode()) ?? null;
});
</script>

<template>
    <main class="flex min-h-svh items-center justify-center p-4">
        <Card class="w-full max-w-sm">
            <CardHeader>
                <CardTitle>Confirm it's you</CardTitle>
                <CardDescription>
                    We emailed you a sign-in code. Enter it to finish signing
                    in.
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
                            <FormLabel>Sign-in code</FormLabel>
                            <FormControl>
                                <CodeInput
                                    v-bind="componentField"
                                    @complete="submit()"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    </FormField>

                    <div class="flex items-center gap-2">
                        <Checkbox id="trust-device" v-model="trustDevice" />
                        <Label for="trust-device">
                            Trust this device for 30 days
                        </Label>
                    </div>

                    <Button type="submit" :disabled="isSubmitting">
                        <Spinner v-if="isSubmitting" />
                        Sign in
                    </Button>

                    <ResendCode :send="sendCode" @error="formError = $event" />

                    <p class="text-muted-foreground text-center text-sm">
                        <RouterLink class="underline" to="/sign-in">
                            Back to sign in
                        </RouterLink>
                    </p>
                </form>
            </CardContent>
        </Card>
    </main>
</template>
