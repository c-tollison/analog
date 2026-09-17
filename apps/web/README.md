# @analog/web

The Analog web client, built with Vue 3 and Vite.

## Scripts

```bash
# Start the Vite dev server
pnpm dev

# Type-check and build for production
pnpm build

# Type-check only
pnpm typecheck
```

## Docker

Build from the repo root. `VITE_API_URL` is baked into the bundle at build
time and is required. Serves on port 8080 via `nginx.conf` (SPA fallback,
asset caching) on the unprivileged nginx image.

```bash
# Build
docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://analog.coji-dev.com -t analog-web .

# Run, then fetch a deep path from a sibling container (should return index.html)
docker run -d --name analog-web-test --network analog_default analog-web
docker run --rm --network analog_default analog-api \
  node -e "fetch('http://analog-web-test:8080/some/route').then(r=>r.text()).then(console.log)"

# Clean up
docker rm -f analog-web-test
```
