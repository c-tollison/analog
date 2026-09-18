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

# Start local Postgres (if not already running), then all app dev servers
pnpm dev

# Build every workspace package
pnpm build

# Start / stop the local Postgres container (docker-compose.local.yml)
pnpm local:up
pnpm local:down

# Stop, wipe the database volume, and start fresh
pnpm local:reset

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

## Deployment

Runs on a VPS set up with [vps-infra](https://github.com/c-tollison/vps-infra),
which provides the shared `vps` Docker network, Traefik with automatic HTTPS,
and a single Postgres server. Every push to `main` runs
`.github/workflows/deploy.yml`: lint and build, build both images for
amd64, push them to GitHub Container Registry, then SSH into the VPS and run
`docker compose pull && docker compose up -d`.

The VPS holds no source and builds nothing. It has one directory:

```
~/analog/
  docker-compose.yml   # delivered by the workflow on every deploy
  .env                 # written once by hand, never leaves the box
```

### One-time setup

1. **Database.** On the VPS, in `vps-infra`: `scripts/create-db.sh analog`.
   Keep the URL it prints.
2. **Env file.** On the VPS: `mkdir ~/analog`, then write `~/analog/.env`
   from `.env.example` with `STAGE=deployed` and `DATABASE_URL=` set to that
   URL. `chmod 600 ~/analog/.env`. Do not copy `docker-compose.yml`; the workflow
   delivers it on every deploy.
3. **Deploy key.** On your laptop, using the ssh user that is in the
   `docker` group on the VPS: fill it user and ports based on server settings. 
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/analog-deploy -C github-actions-analog -N ""
   ssh-copy-id -p <port> -i ~/.ssh/analog-deploy.pub <user>@<host>
   ssh-keyscan -p <port> -H <host>
   # verify: should print containers without a password prompt
   ssh -i ~/.ssh/analog-deploy -o IdentitiesOnly=yes -p <port> <user>@<host> 'docker ps'
   ```
4. **Secrets.** Repo Settings, Secrets and variables, Actions:

   | Secret            | Value                                                          |
   | ----------------- | -------------------------------------------------------------- |
   | `VPS_HOST`        | host or IP                                                     |
   | `VPS_PORT`        | ssh port                                                       |
   | `VPS_USER`        | ssh user in the `docker` group                                 |
   | `VPS_SSH_KEY`     | contents of `~/.ssh/analog-deploy`, including BEGIN/END lines  |
   | `VPS_KNOWN_HOSTS` | full output of the `ssh-keyscan` command                       |

5. **Push to `main`.** Watch the run under Actions. The deploy job ends with
   `docker compose ps`; api and web should be healthy and migrate exited 0.
   Then `curl https://analog.coji-dev.com/api/health`.

If the deploy job fails it is almost always a secret. Fix it and use
"Re-run failed jobs"; no new push needed.

### Day to day

- **Deploy:** push to `main`.
- **Logs:** on the VPS, `cd ~/analog && docker compose logs -f api`.
- **Roll back:** every build is also tagged `sha-<commit>`. On the VPS, edit
  the two `image:` tags in `docker-compose.yml` to that sha and
  `docker compose up -d`. The next push to `main` overwrites the file again.
- **Migrations:** the `migrate` service runs `drizzle` SQL from
  `packages/db/drizzle` before the API starts, on every deploy. It is a no-op
  when nothing is new.