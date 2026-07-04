# analog

TypeScript monorepo starter: Hono API, React (Vite) frontend, Postgres via Drizzle ORM. I created this template because
every new project I start ends up needing the same setup. I find other templates lacking or they try to lock you into a
provider. I prefer this kind of full-stack type safety. It lets me build with some peace of mind and cuts down on bugs
compared to my previous setups. I've tried to keep everything slim. You'll find a working example built around a sample
`users` table. I'd recommend clicking around the codebase to get a feel for how the types flow end to end.

I'd recommend using pnpm for this project. It has tooling that makes this monorepo work nicely. For example, the
catalog, which lets you pin dependency versions globally. That matters a lot for Hono and Zod, since they drive the
full-stack type safety and differing versions between packages could bite you. pnpm also has some default safety
mechanisms, like a minimum package age, which help in the age of AI-assisted coding. It feels like there's a new
vulnerability every few weeks.

I've had a lot of luck using this stack with AI agents. Having the agent run checks and builds from the root gives it
fast feedback on type safety. I've found many AI agents lean on type casting as a cheap way to skirt doing things
properly, so keep an eye out for that.

Each package README goes into a bit more depth, but here's the high-level flow, using the `users` table as an example.

1. **Define the DB schema** in `packages/db`

    ```ts
    // packages/db/src/schema/users.ts
    export const users = appSchema.table('users', {
        id: id(),
        name: text('name').notNull(),
        createdAt: createdAt(),
    });
    ```

2. **Write a Zod schema** in `packages/types` for each request you accept (I prefer hand-rolling these rather than
   generating them).

    ```ts
    // packages/types/src/schemas/users.ts
    export const CreateUserRequestSchema = z.object({
        name: z.string().trim().min(1).max(255),
    });

    export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
    ```

3. **Create an API route** that validates the request against that schema via middleware, then hands the parsed body
   straight to Drizzle.

    ```ts
    // apps/api/src/routes/users.ts
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

   Because `name` is already validated, TypeScript will complain if it doesn't match what `schema.users` expects.

4. **Call it from the frontend** using the Hono RPC client, which types the request and response from the route
   definition itself.

    ```ts
    // apps/ui/src/hooks/use-user-mutations.ts
    export function useCreateUserMutation() {
        return useMutation({
            mutationFn: async (data: CreateUserRequest) => {
                const res = await client.api.users.$post({ json: data });
                if (!res.ok) return throwApiError(res);
                return res.json();
            },
        });
    }
    ```

All of this together catches a surprising number of type errors, and it's saved me a lot of debugging.
There is one small caveat: since I prefer hand-rolled Zod schemas, if the DB schema changes but
the corresponding Zod schema doesn't, it's possible to miss the drift (though the API route itself should still
error if the request body doesn't match what Drizzle expects). You can avoid this by generating your Zod
schemas from the DB schema with `drizzle-zod`, and regenerating them every time you run a migration. I chose not to
do that by default because I find it overly verbose for most of my needs.

I'll keep updating this template with common utilities and changes as I find the need for them.

Some things I plan to add eventually:
- auth middleware that's provider-agnostic
- pagination helpers
- webhook templates that work well with local testing (ngrok)
- SQL transaction wrapper utilities

I hope this template works well for your needs. Feel free to open a GitHub issue or submit a pull request if you
think something could be done better.

## Stack

| Layer | Tech |
| --- | --- |
| Package manager | [pnpm](https://pnpm.io) 11.9.0 (workspaces + catalog) |
| Runtime | [Node.js](https://nodejs.org) 24.12.0 |
| API | [Hono](https://hono.dev) 4 on `@hono/node-server` |
| Frontend | [React](https://react.dev) 19 + [Vite](https://vite.dev) 8 + [Tailwind CSS](https://tailwindcss.com) 4 |
| Database | [PostgreSQL](https://www.postgresql.org) 18 + [Drizzle ORM](https://orm.drizzle.team) |
| Validation | [Zod](https://zod.dev) |
| Lint/format | [Biome](https://biomejs.dev) 2 |
| Git hooks | [Husky](https://typicode.github.io/husky) + lint-staged |

## Layout

```
apps/
  api/       Hono HTTP server (@analog/api)
  ui/        React SPA (@analog/ui)
packages/
  db/        Drizzle schema, migrations, seed data (@analog/db)
  server/    Shared server middleware/logging (@analog/server)
  types/     Shared zod schemas & types (@analog/types)
```

Each package has its own README with package-specific commands.

## Prerequisites

- Node 24.12.0 (see `.tool-versions`, e.g. via [asdf](https://asdf-vm.com) or [mise](https://mise.jdx.dev))
- pnpm 11.9.0 (`corepack enable` or `npm i -g pnpm@11.9.0`)
- [Docker](https://www.docker.com) (for local Postgres)

## Setup

Install dependencies:

```bash
pnpm install
```

Copy env files:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/ui/.env.example apps/ui/.env.local
cp packages/db/.env.example packages/db/.env
```

The root `.env` sets `POSTGRES_PORT` for `docker-compose.yml` (defaults to `5432`). Only change it if that port is already taken and if you do, update the port in `apps/api/.env` (`DB_PORT`) and `packages/db/.env` (`DATABASE_URL_ADMIN`) to match.

Start Postgres and run migrations — see [packages/db](packages/db) for why there's no migration yet on a fresh clone:

```bash
pnpm local:up
```

Run the API and UI together:

```bash
pnpm dev
```

API: http://localhost:3001/api · UI: http://localhost:5173

## Root scripts

Run the api + ui dev servers concurrently:

```bash
pnpm dev
```

Build all packages, in dependency order:

```bash
pnpm build
```

Format + lint, writing fixes:

```bash
pnpm check
```

Format + lint check only, no writes (what CI runs):

```bash
pnpm check:ci
```

Start Postgres via Docker, then migrate and seed it:

```bash
pnpm local:up
```

Stop Postgres and remove its volume:

```bash
pnpm local:down
```

Reset the local DB (`local:down` + `local:up`):

```bash
pnpm local:reset
```

Generate a Drizzle migration from schema changes; pass a name with the `--name` flag:

```bash
pnpm db:generate --name=add_users_table
```

Apply pending Drizzle migrations:

```bash
pnpm db:migrate
```

Scaffold a new project from this template (`scripts/copy-project.mjs`):

```bash
pnpm copy [project_name] [location]
```

## CI

`.github/workflows/pr.yml` runs on pull requests. Pre-commit hooks (Husky + lint-staged) run Biome on staged files.
