import type { Logger } from './logger.js';

interface CloseableServer {
    close(callback: (err?: Error) => void): void;
}

/**
 * SIGTERM/SIGINT: stop accepting connections, let in-flight requests
 * finish, run the app's cleanup (drain the pg pool), then let the event
 * loop empty so the process exits on its own. Calling process.exit here
 * would drop buffered log output. A second signal falls through to the
 * default handler and kills immediately.
 *
 * Docker sends SIGTERM on `compose down` / redeploy and waits 10s by
 * default before SIGKILL, so keep timeoutMs under that.
 */
export function registerGracefulShutdown(
    server: CloseableServer,
    logger: Logger,
    onCleanup: () => Promise<void>,
    timeoutMs = 8_000
) {
    function shutdown(signal: NodeJS.Signals) {
        logger.info({ signal }, 'Shutting down');

        server.close(async (err) => {
            if (err) {
                logger.error({ error: err.message }, 'Error closing server');
                process.exit(1);
            }

            try {
                await onCleanup();
            } catch (cleanupErr) {
                logger.error(
                    { error: getMessage(cleanupErr) },
                    'Error during shutdown cleanup'
                );
                process.exit(1);
            }

            logger.info('Shutdown complete');
        });

        setTimeout(() => {
            logger.error('Forced shutdown after timeout');
            process.exit(1);
        }, timeoutMs).unref();
    }

    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
}

function getMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}
