// Entry point for the Better Auth CLI (`auth generate`), which needs a module
// exporting a `betterAuth` instance named `auth`. Not used at runtime.
import { CreateAuthInstance } from './src/lib/auth.js';
import { loadConfig } from './src/lib/config.js';
import { createDbClient } from './src/lib/db.js';
import { createLogger } from './src/lib/logger.js';

const config = loadConfig();
const logger = createLogger(config.stage);

export const auth = CreateAuthInstance(
    config,
    logger,
    createDbClient(config, logger)
);
