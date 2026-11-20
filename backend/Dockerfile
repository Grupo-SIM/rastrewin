# syntax=docker/dockerfile:1
# O contexto é a raiz do monorepo: docker build -f backend/Dockerfile .
FROM oven/bun:1.4.4 AS bun

FROM node:24.22.1-slim AS build
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

FROM node:24.22.1-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
# O runtime precisa do prisma e do tsx (devDependencies) para o db push e o seed-admin.
COPY --from=build --chown=node:node /app/node_modules node_modules
COPY --from=build --chown=node:node /app/backend backend
# Sem root: um erro na API não vira acesso ao container inteiro.
USER node
EXPOSE 3011
# start-period longo: antes de a API subir, o boot roda o db push e o seed-admin.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3011)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
WORKDIR /app/backend
# "db push" cria/sincroniza o schema (tabelas/colunas que faltam) sem apagar dados
# existentes — o estado dos sorteios sobrevive a restart/redeploy. Sem --accept-data-loss
# de propósito: uma mudança destrutiva no schema falha aqui em vez de apagar dados sozinha.
# seed-admin garante (idempotente) que a conta admin única existe com a senha do ambiente.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx prisma/seed-admin.ts && node dist/main"]
