import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';

import * as schema from './schema/index.js';

// Re-export common operators
export {
    and,
    asc,
    count,
    desc,
    eq,
    gte,
    ilike,
    inArray,
    isNotNull,
    isNull,
    lt,
    not,
    or,
    sql,
} from 'drizzle-orm';

export { schema };

export type Database = ReturnType<typeof createDb>;

export function createDb(config: PoolConfig) {
    const pool = new Pool(config);
    return drizzle(pool, { schema });
}
