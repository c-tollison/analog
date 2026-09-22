import type { ApiRoutes } from './app.js';
import { hc } from 'hono/client';

export type { InferResponseType } from 'hono/client';

// https://hono.dev/docs/guides/rpc#compile-your-code-before-using-it-recommended
const client = hc<ApiRoutes>('');
export type Client = typeof client;

export const hcWithType = (...args: Parameters<typeof hc>): Client =>
    hc<ApiRoutes>(...args);
