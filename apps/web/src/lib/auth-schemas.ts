import { SignUpSchema } from '@analog/types';

import { z } from 'zod';

export { SignInSchema, SignUpSchema } from '@analog/types';

// Client-only for confirming user typos in password
export const SignUpFormSchema = SignUpSchema.extend({
    confirmPassword: z.string().min(1, 'Confirm your password'),
}).refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});
