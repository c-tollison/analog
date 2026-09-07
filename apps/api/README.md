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

`.env` holds secrets and per-machine overrides. Copy `.env.example` to `.env` to get started.
`config/config.toml` holds the per-stage, non-secret settings and is checked into the repo. 