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

Build from the repo root. The build requires `VITE_API_URL` and bakes it into
the bundle. The image is based on unprivileged nginx and serves on port 8080.
`nginx.conf` serves `index.html` for any path that isn't a file, and caches
everything under `/assets/` for a year.

```bash
# Build
docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://analog.coji-dev.com -t analog-web .

# Run, then fetch a deep path from a sibling container. It should return index.html.
docker run -d --name analog-web-test --network analog_default analog-web
docker run --rm --network analog_default analog-api \
  node -e "fetch('http://analog-web-test:8080/some/route').then(r=>r.text()).then(console.log)"

# Clean up
docker rm -f analog-web-test
```
