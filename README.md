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
which provides the shared `vps` and `db` Docker networks, Traefik with
automatic HTTPS, a single Postgres server, and the deploy script. Every push
to `main` runs `.github/workflows/deploy.yml`: lint and build, build both
images for amd64, push them to GitHub Container Registry tagged `latest` and
`sha-<commit>`, then SSH into the VPS with the tag.

The SSH key the workflow uses is bound to a forced command on the VPS, so the
only thing it can do is hand vps-infra's `deploy.sh` a tag. It cannot run
other commands, copy files, or read the `.env`. The VPS holds no source and
builds nothing. It has one directory:

```
~/analog/
  docker-compose.yml   # copied by hand, from this repo
  .env                 # written once by hand, never leaves the box
```

### One-time setup

1. **Database.** On the VPS, in `vps-infra`: `scripts/create-db.sh analog`.
   Keep the URL it prints.
2. **Env file.** On the VPS: `mkdir ~/analog`, then write `~/analog/.env`
   from `.env.example` with `STAGE=deployed`, `DATABASE_URL=` set to that
   URL, `BETTER_AUTH_SECRET=` set to `openssl rand -base64 32`,
   `RESEND_API_KEY=` set to a Resend sending key for the domain in
   `[deployed.email].from` (`apps/api/config/config.toml`), and
   `IMAGE_TAG=` left empty. `chmod 600 ~/analog/.env`.
3. **Compose file.** Copy `docker-compose.yml` from this repo to `~/analog/`.
   Do this again whenever it changes; the workflow does not deliver it.
4. **Deploy key.** On your laptop:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/analog-deploy -C github-actions-analog -N ""
   cat ~/.ssh/analog-deploy.pub
   ssh-keyscan -p <port> -H <host>
   ```
   On the VPS, append one line to `~/.ssh/authorized_keys`, with the public
   key from `cat` above and the absolute path of your `vps-infra` checkout:
   ```
   restrict,command="/home/<user>/vps-infra/scripts/deploy.sh analog" ssh-ed25519 AAAA... github-actions-analog
   ```
   Verify from your laptop. The first must be refused, the second deploys
   whatever tag you name:
   ```bash
   ssh -i ~/.ssh/analog-deploy -o IdentitiesOnly=yes -p <port> <user>@<host> 'docker ps'
   ssh -i ~/.ssh/analog-deploy -o IdentitiesOnly=yes -p <port> <user>@<host> sha-<short sha>
   ```
5. **Secrets.** Repo Settings, Secrets and variables, Actions:

   | Secret            | Value                                                          |
   | ----------------- | -------------------------------------------------------------- |
   | `VPS_HOST`        | host or IP                                                     |
   | `VPS_PORT`        | ssh port                                                       |
   | `VPS_USER`        | ssh user in the `docker` group                                 |
   | `VPS_SSH_KEY`     | contents of `~/.ssh/analog-deploy`, including BEGIN/END lines  |
   | `VPS_KNOWN_HOSTS` | full output of the `ssh-keyscan` command                       |

6. **Push to `main`.** Watch the run under Actions. The deploy job ends with
   `docker compose ps`; api and web should be healthy and migrate exited 0.
   Then `curl https://analog.coji-dev.com/api/health`.

If the deploy job fails it is almost always a secret. Fix it and use
"Re-run failed jobs"; no new push needed.

### Day to day

- **Deploy:** push to `main`.
- **Logs:** on the VPS, `cd ~/analog && docker compose logs -f api`.
- **Roll back:** on the VPS, set `IMAGE_TAG` in `~/analog/.env` to an older
  `sha-<commit>` and `docker compose up -d`. The next push to `main` moves it
  forward again.
- **Compose changes:** copy the new `docker-compose.yml` to the VPS by hand
  and `docker compose up -d`.
- **Migrations:** the `migrate` service runs `drizzle` SQL from
  `packages/db/drizzle` before the API starts, on every deploy. It is a no-op
  when nothing is new.

### Dependencies

Dependabot alerts are on in repo settings, so a dependency with a known
vulnerability sends an email. Updates are done by hand; there is no
`dependabot.yml`. `pnpm-workspace.yaml` sets `minimumReleaseAge` so a package
version has to be at least 3 days old before it can be installed.
