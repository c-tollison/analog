import { pgSchema, timestamp, uuid } from 'drizzle-orm/pg-core';

/** All application tables live in the "app" Postgres schema (see scripts/init-db.sql) */
export const appSchema = pgSchema('app');

/** UUID as primary key for records */
export const id = () => uuid('id').primaryKey().defaultRandom();

export const createdAt = () =>
    timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
