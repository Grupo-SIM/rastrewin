# syntax=docker/dockerfile:1

# Imagem multiplataforma (linux/amd64 e linux/arm64). O site gerado (HTML/CSS/JS) é igual em
# qualquer processador: o build roda uma vez só, na plataforma nativa de quem compila
# ($BUILDPLATFORM, sem emulação), e só a etapa final (Caddy) é montada para cada plataforma.

# Bun só instala dependências e roda scripts; Next e Vitest rodam no Node.
FROM --platform=$BUILDPLATFORM oven/bun:1.4.4-alpine AS bun

# ---------- build: gera o site estático (frontend/out) e as duas CSPs ----------
FROM --platform=$BUILDPLATFORM node:24.22.1-alpine3.24 AS build
WORKDIR /app
ENV CI=1 NEXT_TELEMETRY_DISABLED=1
# Só na etapa de build (não vai para a imagem final); fixar versões do apk quebraria a cada update do Alpine.
# hadolint ignore=DL3018
RUN apk add --no-cache libgcc libstdc++
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

# Dependências antes do código: esta camada só é refeita quando o lockfile muda.
COPY package.json bun.lock bunfig.toml ./
COPY frontend/package.json frontend/
RUN --mount=type=cache,target=/root/.bun/install/cache \
  bun install --frozen-lockfile

COPY frontend frontend
COPY scripts scripts
# Testes antes do build: teste quebrado não vira imagem. As duas CSPs saem prontas; o modo é
# escolhido ao rodar o container (CSP_MODE), sem rebuild.
RUN --mount=type=cache,target=/app/frontend/.next/cache \
  bun run --cwd frontend test \
  && bun run --cwd frontend build \
  && node scripts/csp-hashes.mjs frontend/out > csp-report-only.caddy \
  && node scripts/csp-hashes.mjs frontend/out --enforce > csp-enforce.caddy

# ---------- runtime: Caddy servindo arquivos estáticos, sem root ----------
FROM caddy:2.11.7-alpine
# Remove a capability de abrir portas < 1024 (não usamos) para rodar com cap_drop: ALL.
RUN setcap -r /usr/bin/caddy \
  && addgroup -S -g 10001 app \
  && adduser -S -D -H -u 10001 -G app app \
  && chown -R app:app /data /config

COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/csp-report-only.caddy /app/csp-enforce.caddy /etc/caddy/
COPY --from=build /app/frontend/out /srv

# Numérico (e não "app"): funciona mesmo onde o nome do usuário não existe.
USER 10001:10001
# report-only (padrão) ou enforce.
ENV CSP_MODE=report-only
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD ["/bin/sh", "-c", "wget -q --spider http://127.0.0.1:8080/ || exit 1"]
# Com CSP_MODE errado, o Caddy só registraria um erro e subiria SEM a CSP completa.
# Aqui o container se recusa a subir, e o erro aparece no deploy.
CMD ["/bin/sh", "-c", "case \"$CSP_MODE\" in report-only|enforce) ;; *) echo \"CSP_MODE inválido: '$CSP_MODE' (use report-only ou enforce)\" >&2; exit 1 ;; esac; exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile"]
