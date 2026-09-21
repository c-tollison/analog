import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Stage } from '@analog/types';

import { parse } from 'smol-toml';
import { z } from 'zod';

const StageConfigSchema = z.object({
    appUrl: z.url(),
    server: z.object({
        port: z.number().int(),
    }),
    cors: z.object({
        origins: z.array(z.url()).min(1, 'cors.origins must not be empty'),
    }),
    db: z.object({
        maxConnections: z.number().int().positive(),
        ssl: z.boolean(),
    }),
});

const EnvSchema = z.object({
    STAGE: z.enum(Stage),
    LOG_LEVEL: z
        .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
        .optional(),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    BETTER_AUTH_SECRET: z.string().min(32),
});

type StageConfig = z.infer<typeof StageConfigSchema>;

export type Config = Omit<StageConfig, 'db'> & {
    stage: Stage;
    db: StageConfig['db'] & { url: string };
    auth: { secret: string };
};

const CONFIG_PATH = resolve(import.meta.dirname, '../../config/config.toml');

export function loadConfig(
    env: NodeJS.ProcessEnv = process.env,
    configPath = CONFIG_PATH
): Config {
    const parsedEnv = EnvSchema.parse(env);
    const stage = parsedEnv.STAGE;

    const toml = parse(readFileSync(configPath, 'utf-8'));

    const stageTable = toml[stage];
    if (!stageTable) {
        throw new Error(`No config for stage '${stage}' in ${configPath}`);
    }

    const stageConfig = StageConfigSchema.parse(stageTable);

    return {
        stage,
        ...stageConfig,
        db: { ...stageConfig.db, url: parsedEnv.DATABASE_URL },
        auth: { secret: parsedEnv.BETTER_AUTH_SECRET },
    };
}
