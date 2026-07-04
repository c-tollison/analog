import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type * as schema from '../schema/index.js';

export type SeedContext = {
    db: NodePgDatabase<typeof schema>;
};

export async function runSeed(ctx: SeedContext) {
    await ctx.db.transaction(async (tx) => {
        await tx.execute(sql`set local search_path to "app", public`);
    });
}
