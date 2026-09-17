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

## Docker

Build from the repo root so workspace packages are in context. Local Postgres
must be up (`pnpm local:start`); the container reaches it as `analog-db:5432`
on the `analog_default` network.

```bash
# Build
docker build -f apps/api/Dockerfile -t analog-api .

# Apply migrations from the image
docker run --rm --network analog_default \
  -e DATABASE_URL=postgres://analog:analog@analog-db:5432/analog \
  analog-api node node_modules/@analog/db/dist/scripts/migrate.js

# Run the API, then hit it from a sibling container (no ports are published)
docker run -d --name analog-api-test --network analog_default \
  -e STAGE=deployed -e DATABASE_URL=postgres://analog:analog@analog-db:5432/analog analog-api
docker run --rm --network analog_default analog-api \
  node -e "fetch('http://analog-api-test:3001/api/hello-world').then(r=>r.text()).then(console.log)"

# Clean up
docker rm -f analog-api-test
```
