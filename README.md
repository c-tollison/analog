# Analog

Analog tracks the physical media you own, so you can check what's on your shelf back home. It covers CDs, DVDs, video games, books, manga and comics. Scan a book's barcode to add it to a collection.

I'm building it to get better at:
- Fullstack TypeScript
- API design with end-to-end type safety
- Database management
- Session auth with token rotation
- Self-hosting on a VPS with a reverse proxy, TLS, a CDN and zero-downtime deploys
- CI/CD with automated testing
- Observability with structured logs, metrics and uptime monitoring
- Pulling data from outside sources

## Development

### Root scripts

```bash
# Format and lint, applying safe fixes in place
pnpm check

# Format and lint without writing changes. CI runs this one.
pnpm check:ci

# Start local Postgres if it isn't running, then the API and web dev servers
pnpm dev

# Build every workspace package
pnpm build

# Start local Postgres, then migrate and seed it
pnpm local:up

# Stop local Postgres
pnpm local:down

# Stop, wipe the database volume, then run local:up
pnpm local:reset

# Generate a migration from schema changes, apply migrations, seed test data
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Look up every book with an ISBN again on Google Books and Open Library, and
# update its cover and details. Series and volumes aren't changed. Add
# `--dry-run` to list the books without changing them.
pnpm books:refresh

# Add one or more shadcn-vue components to the web app
pnpm add-component button
pnpm add-component button card dialog
```

### Adding shadcn-vue components

`pnpm add-component <name...>` wraps the shadcn-vue CLI in `scripts/add-component.mjs`. It:

1. Runs `shadcn-vue add` from `apps/web`, so it reads
   `apps/web/components.json`. Components land in
   `apps/web/src/components/shadcn-components/`.
2. Never overwrites an existing component. It answers no to every
   overwrite prompt and refuses `--overwrite`.
3. Formats the new files.

With no component name, it opens the shadcn interactive picker.

### Formatting and linting

Biome formats and lints everything except the templates in `.vue` files,
which it can't format. Prettier formats `.vue` files. Both run in
`pnpm check` and in the lint-staged pre-commit hook.

## Deployment

The app runs on a VPS set up with [vps-infra](https://github.com/c-tollison/vps-infra).
vps-infra provides the shared `vps` and `db` Docker networks, Traefik with
automatic HTTPS, one Postgres server and the deploy script.

Every push to `main` runs `.github/workflows/deploy.yml`. The workflow lints
and builds, then builds both images for amd64. It pushes them to GitHub
Container Registry tagged `latest` and `sha-<commit>`, then SSHes into the VPS
with the tag.

The workflow's SSH key is bound to a forced command on the VPS. All it can do
is pass a tag to vps-infra's `deploy.sh`. It can't run other commands, copy
files or read the `.env`. The VPS holds no source and builds nothing. It has
one directory:

```
~/analog/
  docker-compose.yml   # copied by hand, from this repo
  .env                 # written once by hand, never leaves the box
```

### One-time setup

1. **Database.** On the VPS, in `vps-infra`, run `scripts/create-db.sh analog`.
   Keep the URL it prints.
2. **Env file.** On the VPS, run `mkdir ~/analog`. Write `~/analog/.env`
   from `.env.example` with these values:
   - `STAGE=deployed`
   - `DATABASE_URL` set to the URL from step 1
   - `BETTER_AUTH_SECRET` set to the output of `openssl rand -base64 32`
   - `RESEND_API_KEY` set to a Resend sending key for the domain in
     `[deployed.email].from` in `apps/api/config/config.toml`
   - `GOOGLE_BOOKS_API_KEY` set to a Google Cloud API key restricted to the
     Books API
   - `IMAGE_TAG` left empty

   Then run `chmod 600 ~/analog/.env`.
3. **Compose file.** Copy `docker-compose.yml` from this repo to `~/analog/`.
   Copy it again whenever it changes. The workflow doesn't deliver it.
4. **Deploy key.** On your laptop:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/analog-deploy -C github-actions-analog -N ""
   cat ~/.ssh/analog-deploy.pub
   ssh-keyscan -p <port> -H <host>
   ```
   On the VPS, append one line to `~/.ssh/authorized_keys`. Use the public
   key that `cat` printed and the absolute path of your `vps-infra` checkout:
   ```
   restrict,command="/home/<user>/vps-infra/scripts/deploy.sh analog" ssh-ed25519 AAAA... github-actions-analog
   ```
   Test it from your laptop. The VPS should refuse the first command and
   deploy the tag you name in the second:
   ```bash
   ssh -i ~/.ssh/analog-deploy -o IdentitiesOnly=yes -p <port> <user>@<host> 'docker ps'
   ssh -i ~/.ssh/analog-deploy -o IdentitiesOnly=yes -p <port> <user>@<host> sha-<short sha>
   ```
5. **Secrets.** In the repo, open Settings, then Secrets and variables, then
   Actions, and add:

   | Secret            | Value                                                          |
   | ----------------- | -------------------------------------------------------------- |
   | `VPS_HOST`        | host or IP                                                     |
   | `VPS_PORT`        | ssh port                                                       |
   | `VPS_USER`        | ssh user in the `docker` group                                 |
   | `VPS_SSH_KEY`     | contents of `~/.ssh/analog-deploy`, including BEGIN/END lines  |
   | `VPS_KNOWN_HOSTS` | full output of the `ssh-keyscan` command                       |

6. **First deploy.** Push to `main` and watch the run under Actions. The
   deploy job ends with `docker compose ps`. The api and web services should
   be healthy, and migrate should have exited with code 0. Then run
   `curl https://analog.coji-dev.com/api/health`.

When the deploy job fails, the cause is usually a wrong secret. Fix it and
click "Re-run failed jobs". You don't need a new push.

### Day to day

- **Deploy.** Push to `main`.
- **Logs.** On the VPS, run `cd ~/analog && docker compose logs -f api`.
- **Roll back.** On the VPS, set `IMAGE_TAG` in `~/analog/.env` to an older
  `sha-<commit>` and run `docker compose up -d`. The next push to `main`
  deploys the latest image again.
- **Compose changes.** Copy the new `docker-compose.yml` to the VPS by hand
  and run `docker compose up -d`.
- **Migrations.** On every deploy, the `migrate` service applies any new SQL
  migrations from `packages/db/drizzle` before the API starts. With no new
  migrations it does nothing.
- **Refresh books.** To look up every book with an ISBN again, run
  `cd ~/analog && docker compose run --rm --no-deps api node
  dist/scripts/refresh-books.js`. Add `--dry-run` to list them first. Series
  and volumes aren't changed.

### Dependencies

Dependabot alerts are on in the repo settings, so GitHub sends an email when
a dependency has a known vulnerability. Update dependencies by hand. There is
no `dependabot.yml`. `pnpm-workspace.yaml` sets `minimumReleaseAge`, so pnpm
won't install a package version until it is 3 days old.
