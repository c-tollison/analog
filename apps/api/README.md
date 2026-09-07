# @analog/api

The Analog API, built with Hono and Node.js.

## Scripts

```bash
# Run the API dev server plus tsc --watch (via concurrently)
pnpm dev

# Run the API dev server only (tsx watch)
pnpm dev:server

# Run tsc --watch only
pnpm dev:types

# Build for production
pnpm build

# Run the built server
pnpm start
```
## Config

Config comes in two layers. `.env` holds secrets and per-machine overrides;
right now the only key is `STAGE` (`local` or `deployed`), which picks a table
in `config/config.toml`. Copy `.env.example` to `.env` to get started.
`config/config.toml` holds the per-stage, non-secret settings (`appUrl`,
`server.port`, `cors.origins`) and is checked into the repo. `loadConfig()`
parses both layers into a zod-validated `Config`.