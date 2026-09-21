import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 64;

export const EmailSchema = z.email('Enter a valid email address');

export const PasswordSchema = z
    .string()
    .min(
        PASSWORD_MIN_LENGTH,
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
    )
    .max(
        PASSWORD_MAX_LENGTH,
        `Password must be at most ${PASSWORD_MAX_LENGTH} characters`
    );

export const SignUpSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Name is required')
        .max(
            NAME_MAX_LENGTH,
            `Name must be at most ${NAME_MAX_LENGTH} characters`
        ),
    email: EmailSchema,
    password: PasswordSchema,
});

export const SignInSchema = z.object({
    email: EmailSchema,
    password: z.string().min(1, 'Password is required'),
});

export type SignUpInput = z.infer<typeof SignUpSchema>;
export type SignInInput = z.infer<typeof SignInSchema>;

export const OTP_LENGTH = 6;

export const OtpSchema = z
    .string()
    .regex(
        new RegExp(`^\\d{${OTP_LENGTH}}$`),
        `Enter the ${OTP_LENGTH}-digit code`
    );

export const VerifyOtpSchema = z.object({
    otp: OtpSchema,
});

export const ForgotPasswordSchema = z.object({
    email: EmailSchema,
});

export const ResetPasswordSchema = z.object({
    email: EmailSchema,
    otp: OtpSchema,
    password: PasswordSchema,
});

export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
