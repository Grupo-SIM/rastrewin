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
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
EXPOSE 3011
WORKDIR /app/apps/api
CMD ["node", "dist/main"]
