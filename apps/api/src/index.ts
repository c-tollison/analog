import { createApp } from './app.js';
import { loadConfig } from './lib/config.js';
import { db, init, logger } from './lib/init.js';
import { registerGracefulShutdown } from './lib/shutdown.js';
import { serve } from '@hono/node-server';

async function main() {
    const config = loadConfig();
    await init(config);

    const app = createApp(config);

    const server = serve(
        {
            fetch: app.fetch,
            port: config.server.port,
        },
        (info) => {
            logger().info({ port: info.port }, 'Server is running');
        }
    );

    registerGracefulShutdown(server, logger(), () => db().$client.end());
}

main().catch((err) => {
    // biome-ignore lint/suspicious/noConsole: Logger was unable to start
    console.error('Fatal startup error', err);
    process.exit(1);
});
