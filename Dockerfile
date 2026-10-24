# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM oven/bun:1.4.4-alpine AS bun

FROM --platform=$BUILDPLATFORM node:24.22.1-alpine3.24 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 CI=1
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock bunfig.toml ./
COPY frontend/package.json frontend/
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
COPY frontend frontend
RUN --mount=type=cache,target=/app/frontend/.next/cache \
    bun run --cwd frontend test && bun run --cwd frontend build

FROM node:24.22.1-alpine3.24 AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=node:node /app/frontend/public ./frontend/public
USER node
EXPOSE 3000
CMD ["node", "frontend/server.js"]
