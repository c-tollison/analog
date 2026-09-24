# @analog/api

The Analog API, built with Hono on Node.js.

## Scripts

```bash
# Run the dev server and tsc --watch together
pnpm dev

# Run only the dev server, with tsx watch
pnpm dev:server

# Run only tsc --watch
pnpm dev:types

# Build for production
pnpm build

# Run the built server
pnpm start
```

## Config

`.env` holds secrets and per-machine overrides. Copy `.env.example` to `.env` to get started.
`config/config.toml` holds the non-secret settings for each stage and is checked into the repo.

## Auth emails locally

The API sends verification, sign-in and password reset codes through Resend
only when `RESEND_API_KEY` is set. `STAGE=deployed` requires it. Leave it
unset locally, and the API logs each email instead. Find the code in the
`pnpm dev` terminal:

```
INFO: email to you@example.com (not sent, no RESEND_API_KEY)
Verify your Analog email

Your code is 458949
```

## Docker

Build from the repo root so the workspace packages are in the build context.
Start local Postgres first with `pnpm local:start`. The container reaches it
at `analog-db:5432` on the `analog_default` network.

```bash
# Build
docker build -f apps/api/Dockerfile -t analog-api .

# Apply migrations from the image
docker run --rm --network analog_default \
  -e DATABASE_URL=postgres://analog:analog@analog-db:5432/analog \
  analog-api node node_modules/@analog/db/dist/scripts/migrate.js

# Run the API, then call it from a sibling container. No ports are published.
docker run -d --name analog-api-test --network analog_default \
  -e STAGE=deployed -e RESEND_API_KEY=re_placeholder \
  -e DATABASE_URL=postgres://analog:analog@analog-db:5432/analog analog-api
docker run --rm --network analog_default analog-api \
  node -e "fetch('http://analog-api-test:3001/api/health').then(r=>r.text()).then(console.log)"

# Clean up
docker rm -f analog-api-test
```
