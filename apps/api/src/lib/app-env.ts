import type { Auth } from './auth.js';

type Session = Auth['$Infer']['Session'];

export type AppEnv = {
    Variables: {
        user: Session['user'];
        session: Session['session'];
    };
};
