import { UserRole } from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
    if (c.get('user').role !== UserRole.Admin) {
        throw new HTTPException(403, { message: 'Forbidden' });
    }
    await next();
});
