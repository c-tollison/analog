import type { ApiErrorResponse } from '@analog/types';

import type { Logger } from '../lib/logger.js';
import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

export function createErrorHandler(logger: Logger): ErrorHandler {
    return (err, c) => {
        const requestId = c.get('requestId');

        if (err instanceof HTTPException) {
            logger.warn(
                { requestId, status: err.status, error: err.message },
                'HTTP error'
            );
            return c.json<ApiErrorResponse>({ error: err.message }, err.status);
        }

        logger.error(
            { requestId, error: err.message, stack: err.stack },
            'Unhandled error'
        );
        return c.json<ApiErrorResponse>(
            { error: 'Internal server error' },
            500
        );
    };
}
