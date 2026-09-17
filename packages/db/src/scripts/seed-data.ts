import type { Database } from '../index.js';

/**
 * Local dev seed. Idempotent: safe to run on every `pnpm local:up`.
 * Add inserts here as tables land, using `onConflictDoNothing()`.
 */
export async function runSeed(_db: Database): Promise<void> {
    // No tables yet.
}
