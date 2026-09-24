# CLAUDE.md

Guidance for Claude Code in this repo. The root `README.md` has setup, the script list and deployment.

## Commands

Run these from the repo root with Node 24 and pnpm 12.

- `pnpm dev` starts local Postgres, the API and the web app.
- `pnpm check` runs Biome on everything but `.vue` files and Prettier on `.vue` files, and writes fixes. `pnpm check:ci` runs the same checks without writing. CI runs `check:ci`.
- `pnpm build` builds every package. The web build runs `vue-tsc`, the only typecheck that reads templates.
- `pnpm local:up`, `local:down` and `local:reset` manage the local Postgres container.
- `pnpm db:generate`, `pnpm db:migrate` and `pnpm db:seed` generate migrations, apply them and seed test data.
- `pnpm add-component <name...>` adds shadcn-vue components.
- `pnpm --filter @analog/<name> <script>` runs a script in one package.

**Every change must pass `pnpm check` and `pnpm build`.**

**Claude does no browser testing.** Carson does all UI testing. Stop after check and build. Curl the API when a change needs it, and delete any test data or sessions afterward. When handing off a UI change, write short notes on what to test.

## Architecture

This is a pnpm workspace with a Hono API in `apps/api`, a Vue 3 and Vite SPA in `apps/web`, Postgres through Drizzle in `packages/db`, and shared zod schemas, enums and constants in `packages/types`. Auth is Better Auth with email OTP and two-factor.

Drizzle types the queries and zod validates requests. The web client in `@analog/api/client` takes its types from the Hono app type, so a new API route is typed on the web with no client code.

## API

- Routes select only the columns the UI needs and return the rows as they are, with `c.json(rows)`. Don't write response mappers or `c.json<T>()` annotations. Keep rows flat.
- Lists use `paginate()` from `lib/pagination.ts`.
- Errors are always `{ error: string }`.
- `noConsole` is an error. Use the pino logger.

## Frontend

### shadcn components, always

- **Build every piece of UI from the shadcn-vue components** in `src/components/shadcn-components/`. Before writing markup, check whether shadcn has a component for it. If it isn't installed yet, add it with `pnpm add-component <name>`. Never hand-roll something shadcn covers.
    - Buttons, and links styled as buttons, use `Button`, with `as-child` around `RouterLink`.
    - Top nav links use `NavigationMenu`.
    - List rows that are clickable or have media, a title or actions use `Item` and `ItemGroup`.
    - Empty states use `Empty`.
    - Destructive confirmations use `AlertDialog`.
    - Menus use `DropdownMenu`, with `DropdownMenuLabel` for the header.
    - Errors use `Alert`, through `FormError`. Loading uses `Spinner`.
- Change spacing, sizing and position with the `class` prop and variants. tailwind-merge resolves conflicting classes.
- Fix color and theme problems in the shadcn component or the global CSS, never with a `class` override in a view. For example, if an outline button has no dark-mode hover, fix it in `button/index.ts` instead of adding `dark:hover:` to each button.
- `pnpm add-component` never overwrites existing components. It answers no to every overwrite prompt and rejects `--overwrite`.

### Styling

- Use Tailwind only. Don't write CSS by hand. Prefer theme tokens and the default scale over arbitrary values, so write `text-xs`, not `text-[11px]`.
- Dark mode uses `useColorMode()` from `@vueuse/core`. Never add a second theme mechanism.

### App shell

- Signed-in pages are children of the `/` route, which renders `AppLayout` and sets `meta.requiresAuth`. The shell components `AppLayout`, `AppTopNav` and `UserMenu` live in `src/components/layout/`.
- Pages inside the layout must not set `min-h-svh`. The layout sets the height.

### Data and state

- **API calls.** Each domain gets one composable file in `src/composables/`, such as `useCollections.ts`, `useSeries.ts` and `useCatalog.ts`. The file owns the domain's root query key and exports hooks like `useCollection(id)` and `useCreateCollection()`. Queries call `unwrap(await api.x.$get(...))`. Mutations take ids in their variables and invalidate queries in their own `onSuccess`. Views and components only call these hooks. They never use `useQuery`, `useMutation` or `api` directly.
- **Paginated lists.** Use `usePaginatedList` inside the domain composable and render the list with `PagedList` or `LoadMore`. Search uses `useSearchTerm`.
- **Client state.** Pinia stores live in `src/stores/`. `useSessionStore` holds the session.
- Show errors as `error?.message ?? null`. Every async load shows a spinner.

### Forms

- Forms use `useAppForm`, a zod schema in `lib/*-schemas.ts`, and `FormField`, `FormItem`, `FormLabel`, `FormControl` and `FormMessage`. Use `FormError` for form-level errors. Put a spinner in the submit button. `onSubmit` calls `mutation.mutateAsync`.
- Don't use `z.union` in form schemas. `@vee-validate/zod` crashes on zod v4 union errors.

## Conventions

- **Derive types, never redeclare them.** Don't hand-write interfaces for data that already has a typed source. Get DB rows from Drizzle with `$inferSelect` or `Pick<...>`, request bodies from zod with `z.infer`, and API responses from the client with `InferResponseType<ApiClient['collections']['$get'], 200>`. `@analog/types` holds only request schemas, enums, constants and pure helpers.
- **No type casting.** Don't use `as`, except `as const`, and don't use the non-null `!`. Narrow with a type predicate or a zod parse instead. The only allowed casts are in `unwrap` in `apps/web/src/lib/api.ts`, a generic helper over a conditional type, and in generated shadcn files.
- Biome can't read `.vue` templates, so its unused-import rules are off for `.vue` files. `vue-tsc`, run by the web `build`, catches unused imports there.
- Changing an import that's only used in type positions to `import type` unregisters a component at runtime, and `vue-tsc` still passes. For template refs, type the ref by the methods you call, like `ref<{ focus: () => void }>`, instead of `InstanceType<typeof Component>`.

## Writing

- Use plain English in chat, commits, PRs and comments. Keep sentences short. Say what a thing does, not the name of the technique.
- Write few comments. Add a short one only when the code can't say it.

## Banned words

- slice
- axis
- fence
- floor
- armed
- doctrine
- provenance
- world
