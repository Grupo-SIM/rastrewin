# syntax=docker/dockerfile:1

# ---------- build: gera o site estático (frontend/out) ----------
FROM node:24.22.1-alpine3.24 AS build
WORKDIR /app
ENV CI=1 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile

COPY frontend frontend
COPY scripts scripts
# report-only (padrão) ou enforce: modo da Content-Security-Policy.
ARG CSP_MODE=report-only
RUN pnpm -C frontend test \
  && pnpm -C frontend build \
  && node scripts/csp-hashes.mjs frontend/out $([ "$CSP_MODE" = "enforce" ] && echo --enforce) > csp.caddy

# ---------- runtime: Caddy servindo arquivos estáticos, sem root ----------
FROM caddy:2.11.7-alpine
# Remove a capability de abrir portas < 1024 (não usamos) para rodar com cap_drop: ALL.
RUN setcap -r /usr/bin/caddy \
  && addgroup -S -g 10001 app \
  && adduser -S -D -H -u 10001 -G app app \
  && chown -R app:app /data /config

COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/csp.caddy /etc/caddy/csp.caddy
COPY --from=build /app/frontend/out /srv

USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
