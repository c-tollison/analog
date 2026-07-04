# @analog/ui

React SPA, built with Vite.

## Stack

- [React](https://react.dev) 19
- [Vite](https://vite.dev) 8 (`@vitejs/plugin-react-swc`)
- [React Router](https://reactrouter.com) 8
- [TanStack Query](https://tanstack.com/query) 5 — server state
- [Tailwind CSS](https://tailwindcss.com) 4 (`@tailwindcss/vite`) + `clsx` / `tailwind-merge`
- [Zod](https://zod.dev) — shares schemas from `@analog/types`
- `@analog/api` — imports the API's Hono type for an end-to-end typed client (`src/lib/api.ts`)

## Setup

```bash
cp .env.example .env.local
```

Requires the API running (see [apps/api](../api)).

## Commands

Start the Vite dev server (opens browser):

```bash
pnpm dev
```

Type-check and build for production, output to `dist/`:

```bash
pnpm build
```

Type-check only, no emit:

```bash
pnpm typecheck
```

Serve the production build locally:

```bash
pnpm preview
```

## Config

Env vars (`.env.local`, see `.env.example`): `VITE_API_URL`.

## Example

`src/lib/api.ts` builds the RPC client off the API's own type — no hand-written client, no generated OpenAPI types,
just `hc<ApiRoutes>(...)`:

```ts
export const client = hc<ApiRoutes>(API_BASE, {
    fetch: customFetch,
    init: { credentials: 'include' },
});
```

A mutation hook wraps a call through that client in TanStack Query, sharing the same `CreateUserRequest` type the API
validates against:

```ts
// src/hooks/use-user-mutations.ts
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

`src/pages/users.tsx` is the full loop: `useValidatedSubmit` runs `CreateUserRequestSchema.safeParse` client-side
before the mutation ever fires, so bad input never leaves the browser, and whatever does get sent is already the
shape the API expects. If `client.api.users.$post`'s payload stops matching `CreateUserRequest`, that's a type error
here, not a runtime bug in prod — the same guarantee described in the root README, just from the frontend side.

## Docs

- [Vite docs](https://vite.dev/guide)
- [React Router docs](https://reactrouter.com/en/main)
- [TanStack Query docs](https://tanstack.com/query/latest/docs/framework/react/overview)
- [Tailwind CSS docs](https://tailwindcss.com/docs)
