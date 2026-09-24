import type { Database } from '@analog/db';
import {
    OTP_LENGTH,
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    ResetPasswordSchema,
    SignUpSchema,
    Stage,
    UpdateProfileSchema,
    USERNAME_MAX_LENGTH,
    USERNAME_MIN_LENGTH,
} from '@analog/types';

import type { Config } from './config.js';
import { createEmailSender } from './email.js';
import type { Logger } from './logger.js';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import {
    type EmailOTPOptions,
    emailOTP,
    twoFactor,
    username,
} from 'better-auth/plugins';
import type { ZodType } from 'zod';

const SESSION_EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days
const SESSION_UPDATE_AGE = 60 * 60 * 24; // extend expiry at most once a day
const SESSION_COOKIE_CACHE_MAX_AGE = 60 * 5; // 5 minutes
const OTP_EXPIRES_IN_MINUTES = 10;
const TRUST_DEVICE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

type OtpEmailType = Exclude<
    Parameters<EmailOTPOptions['sendVerificationOTP']>[0]['type'],
    'change-email'
>;

const OTP_EMAIL_SUBJECTS: Record<OtpEmailType, string> = {
    'sign-in': 'Your Analog sign-in code',
    'email-verification': 'Verify your Analog email',
    'forget-password': 'Reset your Analog password',
};

// Only the password + code flows are exposed. Passwordless email-OTP sign-in,
// email change, and self-service TOTP/backup codes would each skip or weaken
// the emailed second factor. Usernames are for finding people, not signing in.
const DISABLED_PATHS = [
    '/sign-in/username',
    '/is-username-available',
    '/sign-in/email-otp',
    '/email-otp/request-email-change',
    '/email-otp/change-email',
    '/two-factor/enable',
    '/two-factor/disable',
    '/two-factor/get-totp-uri',
    '/two-factor/verify-totp',
    '/two-factor/generate-backup-codes',
    '/two-factor/verify-backup-code',
];

const BODY_SCHEMAS: Record<string, ZodType> = {
    '/sign-up/email': SignUpSchema,
    '/email-otp/reset-password': ResetPasswordSchema,
    '/update-user': UpdateProfileSchema.strict(),
};

export type Auth = ReturnType<typeof CreateAuthInstance>;

export function CreateAuthInstance(
    config: Config,
    logger: Logger,
    db: Database
) {
    const sendEmail = createEmailSender(config, logger);

    function sendOtpEmail(email: string, otp: string, type: OtpEmailType) {
        sendEmail({
            to: email,
            subject: OTP_EMAIL_SUBJECTS[type],
            text: [
                `Your code is ${otp}`,
                '',
                `It expires in ${OTP_EXPIRES_IN_MINUTES} minutes. If you didn't request it, you can ignore this email.`,
            ].join('\n'),
        });
    }

    const auth = betterAuth({
        database: drizzleAdapter(db, {
            provider: 'pg',
        }),
        secret: config.auth.secret,
        baseURL: config.appUrl,
        trustedOrigins: config.cors.origins,
        disabledPaths: DISABLED_PATHS,
        advanced: {
            database: { generateId: 'uuid' },
            ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
        },
        logger: {
            level: config.stage === Stage.Local ? 'debug' : 'warn',
            log: (level, message, ...args) => logger[level]({ args }, message),
        },
        session: {
            expiresIn: SESSION_EXPIRES_IN,
            updateAge: SESSION_UPDATE_AGE,
            cookieCache: {
                enabled: true,
                maxAge: SESSION_COOKIE_CACHE_MAX_AGE,
            },
        },
        emailAndPassword: {
            enabled: true,
            minPasswordLength: PASSWORD_MIN_LENGTH,
            maxPasswordLength: PASSWORD_MAX_LENGTH,
            requireEmailVerification: true,
            revokeSessionsOnPasswordReset: true,
        },
        emailVerification: {
            sendOnSignUp: true,
            sendOnSignIn: true,
            autoSignInAfterVerification: true,
        },
        databaseHooks: {
            user: {
                create: {
                    before: async (user) => ({
                        data: { ...user, twoFactorEnabled: true },
                    }),
                },
            },
        },
        plugins: [
            username({
                displayUsername: false,
                minUsernameLength: USERNAME_MIN_LENGTH,
                maxUsernameLength: USERNAME_MAX_LENGTH,
            }),
            emailOTP({
                otpLength: OTP_LENGTH,
                expiresIn: OTP_EXPIRES_IN_MINUTES * 60,
                storeOTP: 'hashed',
                overrideDefaultEmailVerification: true,
                async sendVerificationOTP({ email, otp, type }) {
                    if (type === 'change-email') {
                        return;
                    }
                    sendOtpEmail(email, otp, type);
                },
            }),
            twoFactor({
                issuer: 'Analog',
                trustDeviceMaxAge: TRUST_DEVICE_MAX_AGE,
                otpOptions: {
                    digits: OTP_LENGTH,
                    period: OTP_EXPIRES_IN_MINUTES,
                    storeOTP: 'hashed',
                    sendOTP({ user, otp }) {
                        sendOtpEmail(user.email, otp, 'sign-in');
                    },
                },
            }),
        ],
        hooks: {
            before: createAuthMiddleware(async (ctx) => {
                const schema = BODY_SCHEMAS[ctx.path];
                if (schema) {
                    const result = schema.safeParse(ctx.body);
                    if (!result.success) {
                        throw new APIError('BAD_REQUEST', {
                            message:
                                result.error.issues[0]?.message ??
                                'Invalid request',
                        });
                    }
                }

                if (
                    ctx.path === '/email-otp/send-verification-otp' &&
                    ctx.body?.type === 'sign-in'
                ) {
                    throw new APIError('NOT_FOUND');
                }

                if (ctx.path === '/email-otp/verify-email') {
                    const found =
                        await ctx.context.internalAdapter.findUserByEmail(
                            String(ctx.body?.email ?? '').toLowerCase()
                        );

                    if (found?.user.emailVerified) {
                        throw new APIError('BAD_REQUEST', {
                            message: 'Invalid OTP',
                            code: 'INVALID_OTP',
                        });
                    }
                }
            }),
        },
    });

    logger.info(
        { baseUrl: config.appUrl, trustedOrigins: config.cors.origins },
        'auth initialized'
    );

    return auth;
}
