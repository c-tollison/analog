# @analog/api

Hono HTTP API server, built on `@hono/node-server`.

## Stack

- [Hono](https://hono.dev) 4 — router/middleware
- [@analog/server](../../packages/server) — shared logging, error handling, graceful shutdown, schema validation
- [@analog/db](../../packages/db) — Drizzle client
- [@analog/types](../../packages/types) — shared zod schemas
- Config: `toml` (`config/config.toml`, one table per stage) + `zod` for env validation
- [tsx](https://tsx.is) — dev-time TS execution/watch
- TypeScript, `tsc --watch` for type checking in dev

## Setup

```bash
cp .env.example .env
```

Requires Postgres running (see [packages/db](../../packages/db) or `pnpm local:up` from repo root).

## Commands

Run server (watch) + type-check (watch) concurrently:

```bash
pnpm dev
```

Run only the server in watch mode:

```bash
pnpm dev:server
```

Run only the type-check watcher:

```bash
pnpm dev:types
```

Compile to `dist/`:

```bash
pnpm build
```

Run the compiled server — requires `pnpm build` first:

```bash
pnpm start
```

## Config

Env vars (`.env`, see `.env.example`): `STAGE`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_MAX_CONNECTIONS`.

Per-stage server/CORS settings live in `config/config.toml`, keyed by `STAGE` (`local` / `dev` / `prod`).

## Routes

Mounted under `/api`:

- `GET /api/health`
- `POST /api/users`

## Example

A route is a small `Hono` instance that validates its input with `schemaValidator` (from `@analog/server`) and
talks to Postgres through the shared `db()` client:

```ts
// src/routes/users.ts
const users = new Hono().post(
    '/',
    schemaValidator('json', CreateUserRequestSchema),
    async (c) => {
        const { name } = c.req.valid('json');

        const [user] = await db()
            .insert(schema.users)
            .values({ name })
            .returning();

        return c.json(user, 201);
    }
);
```

It gets mounted in `src/index.ts` with `api.route('/users', users)`. `createApp()`'s return type is exported as
`ApiRoutes` — that's the type the UI imports into `hc<ApiRoutes>(...)` to get a fully typed RPC client, so a new route
here shows up on the frontend with no separate client code to write (see [apps/ui](../ui)).

`db()`, `logger()`, and `config()` all come from `src/lib/container.ts`, which is initialized once in `main()` before
the server starts listening — routes and middleware just pull from it, they don't construct their own clients.

## Docs

- [Hono docs](https://hono.dev/docs)
- [Hono Node.js adapter](https://hono.dev/docs/getting-started/nodejs)
