# syntax=docker/dockerfile:1
# O contexto é a raiz do monorepo: docker build -f backend/Dockerfile .
FROM oven/bun:1.4.4 AS bun

FROM node:20-slim AS build
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock bunfig.toml ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY track/package.json track/
COPY vsl/package.json vsl/
RUN bun install --frozen-lockfile --ignore-scripts --filter backend
COPY backend backend
RUN bun run --cwd backend generate && bun run --cwd backend build

FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
# O runtime precisa do prisma e do tsx (devDependencies) para o db push e o seed-admin.
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/backend backend
EXPOSE 3011
WORKDIR /app/backend
# "db push" cria/sincroniza o schema (tabelas/colunas que faltam) sem apagar dados
# existentes — o estado dos sorteios sobrevive a restart/redeploy. Sem --accept-data-loss
# de propósito: uma mudança destrutiva no schema falha aqui em vez de apagar dados sozinha.
# seed-admin garante (idempotente) que a conta admin única existe com a senha do ambiente.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx prisma/seed-admin.ts && node dist/main"]
