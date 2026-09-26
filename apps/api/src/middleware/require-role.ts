import { hasRole, type UserRole } from '@analog/types';

import type { AppEnv } from '../lib/app-env.js';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

export const requireRole = (role: UserRole) =>
    createMiddleware<AppEnv>(async (c, next) => {
        if (!hasRole(c.get('user'), role)) {
            throw new HTTPException(403, { message: 'Forbidden' });
        }
        await next();
    });
