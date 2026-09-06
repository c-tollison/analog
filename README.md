# Analog

A personal physical media tracker. Forgetting what in your collection back at home? Use analog to track CDs, DVDs, video games, books, manga/comics from anywhere in the world. Later versions will hopefully have a barcode scanner.

Built as a side project to tighten understanding on multiple subjects, including but not limited to:
- Fullstack TypeScript
- API design with end-to-end type safety
- Database management
- Session auth with token rotation
- Self-hosting on a VPS: reverse proxy, TLS, CDN, zero-downtime deploys
- CI/CD with automated testing
- Observability: structured logs, metrics, uptime monitoring
- Integrating with an online data source

## Dev Info

### Important root `package.json` scripts

```bash
# Format and lint, applying safe fixes in place
pnpm check

# Format and lint in check-only mode (used in CI)
pnpm check:ci

# Run all app dev servers
pnpm dev

# Build every workspace package
pnpm build

# Add one or more shadcn-vue components to the web app
pnpm add-component button
pnpm add-component button card dialog
```

### Adding shadcn-vue components

`pnpm add-component <name...>` wraps the shadcn-vue CLI (`scripts/add-component.mjs`):

1. Runs `shadcn-vue add` from inside `apps/web` so it picks up
   `apps/web/components.json`. Components land in
   `apps/web/src/components/shadcn-components/` (the `ui` alias).
2. Formats the generated files: Biome over the new components and `src/lib`,
   then Prettier over the new `*.vue` files.

Passing no component name drops into shadcn-vue's interactive picker.

### Formatting & linting

Using both Biome and Prettier. Biome formats and lints everything except Vue
single-file components; Prettier runs only over `**/*.vue` to format the HTML in
Vue templates (which Biome does not handle). Both run in `pnpm check` and in the
`lint-staged` pre-commit hook.