import * as schema from './schema/index.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';

export type { Column, SQL } from 'drizzle-orm';
export {
    and,
    asc,
    count,
    desc,
    eq,
    exists,
    getTableColumns,
    gte,
    ilike,
    inArray,
    isNotNull,
    isNull,
    lt,
    ne,
    not,
    notInArray,
    or,
    sql,
} from 'drizzle-orm';
export { schema };

export type Database = ReturnType<typeof createDb>;

export function createDb(config: PoolConfig) {
    const pool = new Pool(config);
    return drizzle(pool, { schema });
}
