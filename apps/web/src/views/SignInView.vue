<script setup lang="ts">
import FormError from '@/components/FormError.vue';
import { Alert, AlertDescription } from '@/components/shadcn-components/alert';
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
import { signIn } from '@/lib/auth';
import { SignInSchema } from '@/lib/auth-schemas';
import { getRedirect } from '@/lib/redirect';

import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const { submit, formError, isSubmitting, fieldProps } = useAppForm({
    schema: SignInSchema,
    initialValues: { email: '', password: '' },
    onSubmit: async (values) => {
        const redirect = getRedirect(route.query);
        const { data, error } = await signIn.email(values);

        if (error?.code === 'EMAIL_NOT_VERIFIED') {
            await router.push({
                name: 'verify-email',
                query: { email: values.email, redirect },
            });
            return;
        }
        if (error) {
            return error.message ?? 'Unable to sign in.';
        }

        if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
            await router.push({ name: 'two-factor', query: { redirect } });
            return;
        }

        await router.replace(redirect);
    },
});
</script>

<template>
    <main class="flex min-h-svh items-center justify-center p-4">
        <Card class="w-full max-w-sm">
            <CardHeader>
                <CardTitle>Sign in</CardTitle>
                <CardDescription>
                    Enter your email and password to continue.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form class="grid gap-4" novalidate @submit="submit">
                    <Alert v-if="route.query.reset && !formError">
                        <AlertDescription>
                            Password updated. Sign in with your new password.
                        </AlertDescription>
                    </Alert>
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

                    <FormField
                        v-slot="{ componentField }"
                        v-bind="fieldProps"
                        name="password"
                    >
                        <FormItem>
                            <div class="flex items-center justify-between">
                                <FormLabel>Password</FormLabel>
                                <RouterLink
                                    class="text-muted-foreground text-sm underline"
                                    :to="{ name: 'forgot-password' }"
                                >
                                    Forgot password?
                                </RouterLink>
                            </div>
                            <FormControl>
                                <Input
                                    type="password"
                                    autocomplete="current-password"
                                    v-bind="componentField"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    </FormField>

                    <Button type="submit" :disabled="isSubmitting">
                        <Spinner v-if="isSubmitting" />
                        Sign in
                    </Button>

                    <p class="text-muted-foreground text-center text-sm">
                        Don't have an account?
                        <RouterLink class="underline" to="/sign-up">
                            Sign up
                        </RouterLink>
                    </p>
                </form>
            </CardContent>
        </Card>
    </main>
</template>
