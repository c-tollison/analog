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
import { signUp } from '@/lib/auth';
import { SignUpFormSchema } from '@/lib/auth-schemas';
import { vNoAutofill } from '@/lib/no-autofill';

import { useRouter } from 'vue-router';

const router = useRouter();

const { submit, formError, isSubmitting, fieldProps } = useAppForm({
    schema: SignUpFormSchema,
    initialValues: {
        name: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
    },
    onSubmit: async ({ name, username, email, password }) => {
        const { error } = await signUp.email({
            name,
            username,
            email,
            password,
        });
        if (error) {
            return error.message ?? 'Unable to create your account.';
        }

        await router.push({ name: 'verify-email', query: { email } });
    },
});
</script>

<template>
    <main class="flex min-h-svh items-center justify-center p-4">
        <Card class="w-full max-w-sm">
            <CardHeader>
                <CardTitle>Create an account</CardTitle>
                <CardDescription>
                    It only takes a few seconds to get started.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form class="grid gap-4" novalidate @submit="submit">
                    <FormError :message="formError" />

                    <FormField
                        v-slot="{ componentField }"
                        v-bind="fieldProps"
                        name="name"
                    >
                        <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                                <Input
                                    type="text"
                                    autocomplete="name"
                                    v-bind="componentField"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    </FormField>

                    <FormField
                        v-slot="{ componentField }"
                        v-bind="fieldProps"
                        name="username"
                    >
                        <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                                <Input
                                    type="text"
                                    autocapitalize="none"
                                    spellcheck="false"
                                    v-no-autofill
                                    v-bind="componentField"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    </FormField>

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
                            <FormLabel>Password</FormLabel>
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
                            <FormLabel>Confirm password</FormLabel>
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
                        Create account
                    </Button>

                    <p class="text-muted-foreground text-center text-sm">
                        Already have an account?
                        <RouterLink class="underline" to="/sign-in">
                            Sign in
                        </RouterLink>
                    </p>
                </form>
            </CardContent>
        </Card>
    </main>
</template>
