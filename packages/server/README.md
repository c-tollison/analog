# @analog/server

Shared server utilities for any Hono-based API app: logging, error handling, request validation, and graceful shutdown.

## Stack

- [Hono](https://hono.dev) 4 — middleware types
- [@hono/zod-validator](https://github.com/honojs/middleware/tree/main/packages/zod-validator) — schema validation
- [Pino](https://getpino.io) 10 (+ `pino-pretty` in dev) — logging
- [Zod](https://zod.dev)

## Commands

Compile to `dist/`:

```bash
pnpm build
```

No `dev`/`start` — this package has no runtime entrypoint of its own; it's consumed by `@analog/api`, which type-checks it live in dev via the `development` export condition.

## Layout

```
src/
  logger.ts                       Pino logger factory
  shutdown.ts                     registerGracefulShutdown() — SIGTERM/SIGINT handling
  middleware/
    error-handler.ts              createErrorHandler()
    logging.ts                    createRequestLoggerMiddleware()
    schema-validator.ts           schemaValidator() — zod-backed request validation
```

## Example

`schemaValidator` is a thin wrapper around `@hono/zod-validator` — it exists so a failed validation comes back as
`{ error: string }` instead of Zod's raw issue array, which keeps every error response in the same shape:

```ts
// packages/server/src/middleware/schema-validator.ts
export function schemaValidator<
    Target extends keyof ValidationTargets,
    TSchema extends ZodType,
>(target: Target, schema: TSchema) {
    return zValidator(target, schema, (result, _c) => {
        if (!result.success) {
            const first = result.error.issues[0];
            throw new HTTPException(400, {
                message: first?.message ?? 'Invalid request',
            });
        }
    });
}
```

An API route uses it like this (see [apps/api](../../apps/api) for the full route):

```ts
app.post('/', schemaValidator('json', CreateUserRequestSchema), async (c) => {
    const { name } = c.req.valid('json');
    // ...
});
```

That `HTTPException` then flows into `createErrorHandler`, which is registered once on the app with `app.onError(...)`
and turns any thrown `HTTPException` (or unexpected error) into a logged, consistently shaped JSON response — so
routes never have to try/catch just to format an error.

## Docs

- [Pino docs](https://getpino.io/#/docs/api)
- [Hono middleware guide](https://hono.dev/docs/guides/middleware)
