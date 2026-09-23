import { ResetPasswordSchema, SignUpSchema } from '@analog/types';

import { z } from 'zod';

export {
    ForgotPasswordSchema,
    SignInSchema,
    SignUpSchema,
    UpdateProfileSchema,
    VerifyOtpSchema,
} from '@analog/types';

const confirmPassword = z.string().min(1, 'Confirm your password');

function passwordsMatch(values: { password: string; confirmPassword: string }) {
    return values.password === values.confirmPassword;
}

const passwordMismatch = {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
};

export const SignUpFormSchema = SignUpSchema.extend({ confirmPassword }).refine(
    passwordsMatch,
    passwordMismatch
);

export const ResetPasswordFormSchema = ResetPasswordSchema.omit({
    email: true,
})
    .extend({ confirmPassword })
    .refine(passwordsMatch, passwordMismatch);
