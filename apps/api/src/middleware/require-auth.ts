import type { AppEnv } from '../lib/app-env.js';
import { auth } from '../lib/init.js';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
    const { headers, response } = await auth().api.getSession({
        headers: c.req.raw.headers,
        returnHeaders: true,
    });

    for (const cookie of headers.getSetCookie()) {
        c.header('Set-Cookie', cookie, { append: true });
    }

    if (!response?.user.emailVerified) {
        throw new HTTPException(401, { message: 'Unauthorized' });
    }

    c.set('user', response.user);
    c.set('session', response.session);

    await next();
});
