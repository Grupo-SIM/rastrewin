# syntax=docker/dockerfile:1
# Imagem do app (Next.js standalone). Buildada pelo GitHub Actions e publicada no GHCR.
# O contexto é a raiz do monorepo: docker build -f track/Dockerfile .

ARG NODE_VERSION=26

FROM --platform=$BUILDPLATFORM oven/bun:1.4.4-alpine AS bun

# ---------- geo (base DB-IP City Lite, CC BY 4.0) ----------
# GEO_MONTH muda todo mês no CI → invalida o cache e baixa a base nova.
FROM node:${NODE_VERSION}-alpine AS geo
ARG GEO_MONTH=local
WORKDIR /app
COPY track/scripts/geo-download.sh scripts/geo-download.sh
RUN echo "base de geolocalização: $GEO_MONTH" && sh scripts/geo-download.sh /app/data/geo

# ---------- build ----------
FROM node:${NODE_VERSION}-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock bunfig.toml ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY track/package.json track/
COPY vsl/package.json vsl/
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --ignore-scripts --filter track
COPY track track
# public/ pode não existir no git (pasta vazia não é versionada)
RUN mkdir -p track/public && bun run --cwd track build && bun run --cwd track scripts:build

# ---------- runtime ----------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app/track
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/track/.next/standalone /app
COPY --from=builder --chown=nextjs:nodejs /app/track/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/track/.next/static ./.next/static
# Scripts avulsos (migração e criação de admin) já empacotados, mais as migrations SQL
COPY --from=builder --chown=nextjs:nodejs /app/track/dist-scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/track/drizzle ./drizzle
COPY --from=geo --chown=nextjs:nodejs /app/data ./data

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
