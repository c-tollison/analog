import { appSchema } from './primitives.js';
import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    text,
    timestamp,
    uuid,
} from 'drizzle-orm/pg-core';

export const user = appSchema.table(
    'user',
    {
        id: uuid('id').default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
        name: text('name').notNull(),
        email: text('email').notNull().unique(),
        username: text('username').notNull().unique(),
        emailVerified: boolean('email_verified').default(false).notNull(),
        image: text('image'),
        twoFactorEnabled: boolean('two_factor_enabled').default(true).notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at')
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [
        index('user_name_trgm_idx').using('gin', table.name.op('gin_trgm_ops')),
        index('user_username_trgm_idx').using(
            'gin',
            table.username.op('gin_trgm_ops')
        ),
    ]
);

export const session = appSchema.table(
    'session',
    {
        id: uuid('id').default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
        expiresAt: timestamp('expires_at').notNull(),
        token: text('token').notNull().unique(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at')
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
        userId: uuid('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
    },
    (table) => [index('session_userId_idx').on(table.userId)]
);

export const account = appSchema.table(
    'account',
    {
        id: uuid('id').default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
        accountId: text('account_id').notNull(),
        providerId: text('provider_id').notNull(),
        userId: uuid('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        accessToken: text('access_token'),
        refreshToken: text('refresh_token'),
        idToken: text('id_token'),
        accessTokenExpiresAt: timestamp('access_token_expires_at'),
        refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
        scope: text('scope'),
        password: text('password'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at')
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [index('account_userId_idx').on(table.userId)]
);

export const verification = appSchema.table(
    'verification',
    {
        id: uuid('id').default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
        identifier: text('identifier').notNull(),
        value: text('value').notNull(),
        expiresAt: timestamp('expires_at').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at')
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [index('verification_identifier_idx').on(table.identifier)]
);

export const twoFactor = appSchema.table(
    'two_factor',
    {
        id: uuid('id').default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
        secret: text('secret').notNull(),
        backupCodes: text('backup_codes').notNull(),
        userId: uuid('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        verified: boolean('verified').default(true),
        failedVerificationCount: integer('failed_verification_count').default(
            0
        ),
        lockedUntil: timestamp('locked_until'),
    },
    (table) => [
        index('twoFactor_secret_idx').on(table.secret),
        index('twoFactor_userId_idx').on(table.userId),
    ]
);

export const userRelations = relations(user, ({ many }) => ({
    sessions: many(session),
    accounts: many(account),
    twoFactors: many(twoFactor),
}));

export const sessionRelations = relations(session, ({ one }) => ({
    user: one(user, {
        fields: [session.userId],
        references: [user.id],
    }),
}));

export const accountRelations = relations(account, ({ one }) => ({
    user: one(user, {
        fields: [account.userId],
        references: [user.id],
    }),
}));

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
    user: one(user, {
        fields: [twoFactor.userId],
        references: [user.id],
    }),
}));
