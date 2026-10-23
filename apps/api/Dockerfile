FROM node:20-slim AS build
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace api --include-workspace-root
COPY apps/api apps/api
RUN npm run build -w api

FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace api --include-workspace-root --omit=dev
RUN npm install --no-save prisma@5.22.0 tsx@4.19.0
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/src apps/api/src
COPY --from=build /app/apps/api/data apps/api/data
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
EXPOSE 3011
WORKDIR /app/apps/api
# "db push" cria/sincroniza o schema (tabelas/colunas que faltam) sem apagar dados
# existentes — o estado dos sorteios sobrevive a restart/redeploy. Sem --accept-data-loss
# de propósito: uma mudança destrutiva no schema falha aqui em vez de apagar dados sozinha.
# seed-admin garante (idempotente) que a conta admin única existe com a senha do ambiente.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx prisma/seed-admin.ts && node dist/main"]
