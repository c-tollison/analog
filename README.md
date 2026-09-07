# Analog

A personal physical media tracker. Forgetting what in your collection back at home? Use analog to track CDs, DVDs, video games, books, manga/comics. Later versions will hopefully have a barcode scanner.

Side project to get better at a few things:
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
   `apps/web/components.json`. Components go in
   `apps/web/src/components/shadcn-components/`.
2. Formats the generated files

Passing no component name starts the shadcn interactive picker.

### Formatting & linting

Using both Biome and Prettier. Biome formats and lints everything except Vue
files; Prettier runs those to format the HTML because Biome cannot. Both run in `pnpm check` 
and in the `lint-staged` pre-commit hook.