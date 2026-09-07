import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Stage } from '@analog/types';

import { parse as parseToml } from 'smol-toml';
import { z } from 'zod';

const StageConfigSchema = z.object({
    appUrl: z.url(),
    server: z.object({
        port: z.number().int(),
    }),
    cors: z.object({
        origins: z.array(z.url()).min(1, 'cors.origins must not be empty'),
    }),
});

const EnvSchema = z.object({
    LOG_LEVEL: z
        .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
        .optional(),
});

const StageSchema = z.enum(Stage);

export type Config = z.infer<typeof StageConfigSchema> & {
    stage: Stage;
};

const CONFIG_PATH = resolve(import.meta.dirname, '../../config/config.toml');

export function loadConfig(configPath = CONFIG_PATH): Config {
    const stage = StageSchema.parse(process.env.STAGE);

    EnvSchema.parse(process.env);

    const toml = parseToml(readFileSync(configPath, 'utf-8')) as Record<
        string,
        unknown
    >;

    const stageTable = toml[stage];
    if (!stageTable) {
        throw new Error(`No config for stage '${stage}' in ${configPath}`);
    }

    return {
        stage,
        ...StageConfigSchema.parse(stageTable),
    };
}
