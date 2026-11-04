# syntax=docker/dockerfile:1
# Build context is the monorepo root: docker build -f vsl/Dockerfile .
FROM --platform=$BUILDPLATFORM oven/bun:1.4.4-alpine AS bun

FROM --platform=$BUILDPLATFORM node:24.22.1-alpine3.24 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 CI=1
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock bunfig.toml ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY track/package.json track/
COPY vsl/package.json vsl/
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --ignore-scripts --filter vsl
COPY vsl vsl
RUN --mount=type=cache,target=/app/vsl/.next/cache \
    bun run --cwd vsl test && bun run --cwd vsl build

FROM node:24.22.1-alpine3.24 AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/vsl/.next/standalone ./
COPY --from=build --chown=node:node /app/vsl/.next/static ./vsl/.next/static
COPY --from=build --chown=node:node /app/vsl/public ./vsl/public
USER node
EXPOSE 3000
CMD ["node", "vsl/server.js"]
