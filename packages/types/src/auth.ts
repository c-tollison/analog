import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 64;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

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

export const NameSchema = z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters`);

export const UsernameSchema = z
    .string()
    .trim()
    .toLowerCase()
    .min(
        USERNAME_MIN_LENGTH,
        `Username must be at least ${USERNAME_MIN_LENGTH} characters`
    )
    .max(
        USERNAME_MAX_LENGTH,
        `Username must be at most ${USERNAME_MAX_LENGTH} characters`
    )
    .regex(
        /^[a-z0-9_.]+$/,
        'Use only letters, numbers, underscores and periods'
    );

export const SignUpSchema = z.object({
    name: NameSchema,
    username: UsernameSchema,
    email: EmailSchema,
    password: PasswordSchema,
});

export const UpdateProfileSchema = z.object({
    name: NameSchema,
    username: UsernameSchema,
});

export const SignInSchema = z.object({
    email: EmailSchema,
    password: z.string().min(1, 'Password is required'),
});

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

export enum UserRole {
    Member = 'member',
    Admin = 'admin',
}

// Higher roles can do everything lower ones can.
const ROLE_RANK: Record<UserRole, number> = {
    [UserRole.Member]: 0,
    [UserRole.Admin]: 1,
};

const UserRoleSchema = z.enum(UserRole);

/** Whether the user's role is `role` or above it. */
export function hasRole(
    user: { role?: string | null } | null | undefined,
    role: UserRole
): boolean {
    const parsed = UserRoleSchema.safeParse(user?.role);
    return parsed.success && ROLE_RANK[parsed.data] >= ROLE_RANK[role];
}

export const USER_FIELDS = {
    role: {
        type: [UserRole.Member, UserRole.Admin],
        defaultValue: UserRole.Member,
        input: false as const,
    },
    showCollectionProgress: {
        type: 'boolean' as const,
        defaultValue: true,
        input: false as const,
    },
    isPublic: {
        type: 'boolean' as const,
        defaultValue: true,
        input: false as const,
    },
};

export const UpdatePreferencesSchema = z
    .object({
        showCollectionProgress: z.boolean(),
        isPublic: z.boolean(),
    })
    .partial()
    .refine((values) => Object.keys(values).length > 0, {
        message: 'Nothing to update',
    });
