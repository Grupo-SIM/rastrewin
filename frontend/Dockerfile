# syntax=docker/dockerfile:1
# O contexto é a raiz do monorepo: docker build -f frontend/Dockerfile .
FROM oven/bun:1.4.4-alpine AS bun

FROM node:20-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock bunfig.toml ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY track/package.json track/
COPY vsl/package.json vsl/
RUN bun install --frozen-lockfile --ignore-scripts --filter frontend
COPY frontend frontend
RUN bun run --cwd frontend build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
COPY --from=build /app/frontend/public ./frontend/public
EXPOSE 3000
WORKDIR /app/frontend
CMD ["node", "server.js"]
