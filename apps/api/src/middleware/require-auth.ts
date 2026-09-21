import type { Auth } from '../lib/auth.js';
import { auth } from '../lib/init.js';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

type Session = Auth['$Infer']['Session'];

export type AuthEnv = {
    Variables: {
        user: Session['user'];
        session: Session['session'];
    };
};

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
    const { headers, response } = await auth().api.getSession({
        headers: c.req.raw.headers,
        returnHeaders: true,
    });

    for (const cookie of headers.getSetCookie()) {
        c.header('Set-Cookie', cookie, { append: true });
    }

    if (!response) {
        throw new HTTPException(401, { message: 'Unauthorized' });
    }

    c.set('user', response.user);
    c.set('session', response.session);

    await next();
});
