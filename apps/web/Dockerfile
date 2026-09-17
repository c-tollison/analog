FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN npm install -g pnpm@12.3.4
WORKDIR /repo

# ---- build ---------------------------------------------------------------
FROM base AS build
ENV HUSKY=0
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
RUN pnpm install --frozen-lockfile --offline

# Baked into the bundle at build time. Declared after install so changing it
# does not invalidate the dependency layers.
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || { echo "VITE_API_URL build arg is required" >&2; exit 1; }
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @analog/web... build

# ---- runtime -------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
