import { Stage } from '@analog/types';
import { parse } from 'toml';
import { z } from 'zod';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const StageConfigSchema = z.object({
    server: z.object({
        port: z.number().int(),
    }),
    cors: z.object({
        origins: z.array(z.string()).min(1, 'cors.origins must not be empty'),
    }),
});

const EnvSchema = z.object({
    STAGE: z.enum(Stage),
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int(),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_NAME: z.string().min(1),
    DB_MAX_CONNECTIONS: z.coerce.number().int(),
});

export type Config = z.infer<typeof StageConfigSchema> & {
    stage: Stage;
    db: {
        host: string;
        port: number;
        user: string;
        password: string;
        name: string;
        maxConnections: number;
    };
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
    const parsedEnv = EnvSchema.parse(env);
    const stage = parsedEnv.STAGE;

    const path = resolve(process.cwd(), 'config', 'config.toml');
    const configFile: Record<string, unknown> = parse(
        readFileSync(path, 'utf-8')
    );

    const stageTable = configFile[stage];
    if (!stageTable) {
        throw new Error(`No config found for stage '${stage}' in ${path}`);
    }

    return {
        stage,
        ...StageConfigSchema.parse(stageTable),
        db: {
            host: parsedEnv.DB_HOST,
            port: parsedEnv.DB_PORT,
            user: parsedEnv.DB_USER,
            password: parsedEnv.DB_PASSWORD,
            name: parsedEnv.DB_NAME,
            maxConnections: parsedEnv.DB_MAX_CONNECTIONS,
        },
    };
}
