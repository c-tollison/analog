import { createApp } from './app.js';
import { loadConfig } from './lib/config.js';
import { init, logger } from './lib/init.js';
import { serve } from '@hono/node-server';

async function main() {
    const config = loadConfig();
    await init(config);

    const app = createApp(config);

    serve(
        {
            fetch: app.fetch,
            port: config.server.port,
        },
        (info) => {
            logger().info(
                { url: `http://localhost:${info.port}`, stage: config.stage },
                'Server is running'
            );
        }
    );
}

main().catch((err) => {
    // biome-ignore lint/suspicious/noConsole: Logger was unable to start
    console.error('Fatal startup error', err);
    process.exit(1);
});
