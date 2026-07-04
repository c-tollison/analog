# @analog/types

Shared TypeScript types and Zod schemas, used by both the API and UI (and by `@analog/db`).

## Stack

- [Zod](https://zod.dev) 4 — schemas double as runtime validators and static types (`z.infer`)

## Commands

Compile to `dist/`:

```bash
pnpm build
```

No `dev`/`start` — this package has no runtime entrypoint of its own; consumers type-check it live via the `development` export condition.

## Layout

```
src/
  config.ts        Stage enum, shared config types
  schemas/
    users.ts        e.g. CreateUserRequestSchema
```

Add new request/response contracts here so the API and UI stay in sync on a single source of truth.

## Example

A schema is just a Zod object, exported alongside its inferred type so both the API and the UI can import the type
without re-deriving it:

```ts
// src/schemas/users.ts
export const CreateUserRequestSchema = z.object({
    name: z.string().trim().min(1).max(255),
});

export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
```

The API imports `CreateUserRequestSchema` to validate the request body (see [apps/api](../../apps/api)), and the UI
imports `CreateUserRequest` for the mutation's input type (see [apps/ui](../../apps/ui)) — one schema, no drift
between the two.

I hand-roll these rather than generating them from the Drizzle schema with `drizzle-zod`. That's a deliberate
trade-off: it's more typing up front, and it means a DB column change won't automatically show up here, but I'd
rather write the exact validation I want (trimming, length caps, custom messages) than fight a generated schema.

## Docs

- [Zod docs](https://zod.dev)
