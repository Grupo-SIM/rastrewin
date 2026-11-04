# syntax=docker/dockerfile:1
# Imagem do app (Next.js standalone). Buildada pelo GitHub Actions e publicada no GHCR.

ARG NODE_VERSION=26

# ---------- deps ----------
FROM node:${NODE_VERSION}-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ---------- geo (base DB-IP City Lite, CC BY 4.0) ----------
# GEO_MONTH muda todo mês no CI → invalida o cache e baixa a base nova.
FROM node:${NODE_VERSION}-alpine AS geo
ARG GEO_MONTH=local
WORKDIR /app
COPY scripts/geo-download.sh scripts/geo-download.sh
RUN echo "base de geolocalização: $GEO_MONTH" && sh scripts/geo-download.sh /app/data/geo

# ---------- build ----------
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# public/ pode não existir no git (pasta vazia não é versionada)
RUN mkdir -p public && npm run build && npm run scripts:build

# ---------- runtime ----------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Scripts avulsos (migração e criação de admin) já empacotados, mais as migrations SQL
COPY --from=builder --chown=nextjs:nodejs /app/dist-scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=geo --chown=nextjs:nodejs /app/data ./data

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
