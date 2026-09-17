import { pgSchema, timestamp, uuid } from 'drizzle-orm/pg-core';

export const appSchema = pgSchema('app');

export const id = () => uuid('id').primaryKey().defaultRandom();

export const createdAt = () =>
    timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const timestamps = () => ({
    createdAt: createdAt(),
    updatedAt: updatedAt(),
});
