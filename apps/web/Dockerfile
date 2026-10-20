FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
RUN npm install --workspace web --include-workspace-root
COPY apps/web apps/web
RUN npm run build -w web

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["node", "server.js"]
