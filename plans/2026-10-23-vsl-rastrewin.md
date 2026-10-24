# Plano — VSL Rastrewin (vsl.rastrewin.com)

## Contexto

Página de VSL que antecede https://rastrewin.com: logo, título, subtítulo, vídeo vertical do YouTube, botão que aparece após X segundos **realmente assistidos** e rodapé com aviso Meta. Tem que ser extremamente rápida, segura e seguir a identidade visual da Rastrewin. A página só exibe e redireciona: **sem backend, sem banco, sem coleta de dados, sem pixel/UTM** (rastreamento fica para outra conversa).

## Decisões da entrevista

- **Stack:** Next.js 16 (App Router, `output: 'export'`) + React 19 + TS estrito + Tailwind 4 + shadcn/ui + Zod 4. Sem NestJS/Prisma/Postgres.
- **Estrutura:** monorepo enxuto com pnpm: `frontend/`, `docs/`, `plans/`, `scripts/`, `deploy/`. Sem `backend/` e sem `packages/schemas` por enquanto.
- **Vídeo:** YouTube não listado, carregado do domínio `youtube-nocookie.com`. Mostra só uma capa leve e carrega o YouTube no toque, que já começa com som. Player sem barra de progresso (`controls=0`), e tocar no vídeo pausa e retoma.
- **Delay:** soma dos segundos efetivamente tocando (não a posição), então pular não libera. Depois de liberado, fica gravado no `localStorage` (chave por vídeo) e aparece direto em visitas futuras.
- **Botão:** estilo `.btn-rainbow` da marca, abre `https://rastrewin.com` na mesma aba, com link limpo. Antes de liberar não aparece nada (o rodapé sobe), e ele entra com animação suave, respeitando `prefers-reduced-motion`.
- **Rodapé:** só o aviso de não afiliação com Facebook/Meta.
- **Logo/favicon:** copiados de rastrewin.com/logos/ e servidos localmente.
- **SEO:** `noindex, nofollow` + robots.txt bloqueando, com Open Graph mantido.
- **Infra:** já existe um Caddy central na VM. Entrego um container Caddy interno (servindo os estáticos) e um bloco para o Caddyfile central.

## Identidade visual (extraída do CSS público)

Tokens em `globals.css` (`@theme` do Tailwind 4):
- **Cores:** `--ink #08304c`, `--ink-2 #084e72`, `--ink-soft #4b6478`, `--paper #fff`, `--paper-2 #fafbfc`, `--dark #2c2c2c`.
- **Gradiente:** `--rainbow: linear-gradient(90deg,#26c0ff,#e600c2 20%,#ff4940 40%,#ffa130 60%,#ffc837 80%,#00cc3d)`.
- **Sombras:** `--sh` e `--sh-lg`.
- **Fontes** (via `next/font/google`, auto-hospedadas no build, sem requisição ao Google em runtime): Plus Jakarta Sans (títulos), Manrope (corpo) e Instrument Serif (destaque).
- **Botão:** fundo branco, borda de 3px com o gradiente, pílula, texto `--ink`, altura ~58px, peso 600.

## Arquivos

```
CLAUDE.md                      stack, comandos, convenções, regras + links p/ docs
.gitignore  .env.example       (.env* ignorado; exemplo vazio comentado — site não tem segredos)
package.json  pnpm-workspace.yaml  biome.json
docs/development/project-scaffolding.md  deploy.md  performance-e-seguranca.md
frontend/
  next.config.ts               output:'export', poweredByHeader:false, images.unoptimized
  src/app/layout.tsx           fontes, lang="pt-BR", metadata (noindex, OG, themeColor)
  src/app/page.tsx             server component: logo → título → subtítulo → <VslSection/> → rodapé
  src/app/globals.css          tokens da marca
  src/config/page-config.ts    schema Zod + valores (fonte única do que é editável)
  src/lib/watch-timer.ts       função pura: acumula tempo assistido (testável)
  src/lib/unlock-storage.ts    localStorage com try/catch, chave `rw-vsl:v1:<videoId>`
  src/components/vsl/vsl-section.tsx   'use client' — estado "liberado"
  src/components/vsl/vsl-player.tsx    capa → carrega IFrame API no toque → player 9:16
  src/components/vsl/unlock-cta.tsx    botão + aria-live "Acesso liberado"
  src/components/ui/button.tsx         shadcn (CLI) + variante `rainbow`
  public/logo-rastrewin.svg  favicon  poster.webp (provisório)  robots.txt
  *.test.ts                    Vitest
deploy/
  Dockerfile                   build node:24-alpine (pnpm via corepack) → caddy:2.11.7-alpine, usuário não-root, porta interna 8080
  Caddyfile                    file_server + headers + cache (immutable em /_next/static, no-cache no HTML) + encode zstd gzip
  compose.yaml                 p/ Komodo: sem `ports:` públicos, rede externa do Caddy central, read_only, cap_drop ALL
  caddy-central.snippet        vsl.rastrewin.com { reverse_proxy vsl-rastrewin:8080 } + HSTS
```

## Schema Zod (`page-config.ts`)

`PageConfigSchema = z.object({...}).strict()`, validado no build (se falhar, o build quebra):
- `youtubeId`: `z.string().regex(/^[A-Za-z0-9_-]{11}$/)`
- `unlockAtSeconds`: `z.number().int().positive().max(7200)`
- `destinationUrl`: `z.url()` + refine com protocolo `https:` e host exatamente `rastrewin.com` (evita open redirect por erro de config)
- `posterSrc`: string que começa com `/` (arquivo local)
- `copy`: `{ title: z.string().trim().min(1).max(120), subtitle: .max(240), cta: .max(40), metaDisclaimer: .max(400) }.strict()`

Tipo derivado com `z.infer`. Testes cobrem config válida e inválida (ID errado, host diferente, `http:`, segundos negativos, chave extra).

## Player: como funciona o delay

1. Capa `<button>` com poster (`fetchpriority="high"`, width/height explícitos), ícone play e `aria-label="Assistir ao vídeo"`.
2. No toque, injeta `https://www.youtube.com/iframe_api` e cria `YT.Player` com `host: 'https://www.youtube-nocookie.com'` e `playerVars { autoplay:1, controls:0, disablekb:1, fs:0, rel:0, playsinline:1, iv_load_policy:3 }`.
3. Enquanto o estado é PLAYING, um intervalo de 250ms soma `min(delta real, 1s)`. Quando a soma passa de `unlockAtSeconds`, chama `onUnlock()`, grava no storage e para o timer.
4. Uma camada transparente por cima do iframe alterna pausar/tocar, já que não há controles.
5. Sem JS ou com erro, a capa continua visível, e o vídeo pode ser aberto no YouTube como fallback.

## Segurança

- **Sem dados nem segredos:** não há superfície de backend, SQL ou auth. Nenhuma `NEXT_PUBLIC_` sensível.
- **XSS:** nada de `dangerouslySetInnerHTML`. Os textos vêm do config (React escapa).
- **Open redirect:** o destino é fixo e validado com Zod (somente `https://rastrewin.com`).
- **Headers** (Caddyfile do container): `X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin-when-cross-origin`, `Permissions-Policy` restrita (libera só `autoplay`, `encrypted-media`, `picture-in-picture` para o YouTube), `X-Frame-Options DENY`, `Cross-Origin-Opener-Policy same-origin` e remoção de `Server`. HSTS fica no Caddy central.
- **CSP:** começa em **Report-Only**: `default-src 'self'`, `script-src 'self' 'unsafe-inline' https://www.youtube.com`, `frame-src https://www.youtube-nocookie.com`, `img-src 'self' data: https://i.ytimg.com`, `style-src 'self' 'unsafe-inline'`, `font-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `frame-ancestors 'none'`. Para endurecer depois: `scripts/csp-hashes.mjs` gera hashes sha256 dos scripts inline do `out/` e tira o `'unsafe-inline'` (o export estático não aceita nonce).
- **Privacidade/LGPD:** nenhum cookie e nenhum terceiro antes do toque no vídeo.
- **Supply chain:** poucas dependências, lockfile commitado, `pnpm audit` no fim e builds de dependências só via allowlist (`onlyBuiltDependencies`).
- **Container:** sem root, imagens com versão fixa, filesystem read-only e nenhuma porta publicada (só a rede interna com o Caddy central).

## Dependências novas (e por quê)

- `next`, `react`, `react-dom`, `tailwindcss`, `zod`, `typescript`: stack definida.
- `shadcn` (CLI) + o que o Button exige (`class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`): regra de usar shadcn/ui.
- `@biomejs/biome`: lint e format num só, rápido.
- `vitest`: testes do schema e do timer.
- `@types/youtube`: tipos da IFrame API, para não declarar à mão.
- Não uso `lite-youtube-embed` (a fachada é ~40 linhas próprias, sem dependência). Sem `react-hook-form` (não há formulário).
- **TypeScript:** uso a última versão compatível com o Next 16 (a 7.x se o Next suportar; se não, a última 5.x/6.x suportada, conferida na hora).

## Banco de dados

Nenhum. Nenhuma migration, nenhum comando contra banco.

## Commits (Conventional Commits, sem push)

1. `chore: estrutura inicial do monorepo, Next, Biome e CLAUDE.md` (primeiro commit, depois do `git init`)
2. `feat: tokens visuais, fontes e layout base da Rastrewin`
3. `feat: configuração da página validada com Zod` (+ testes)
4. `feat: player do YouTube com capa e contagem de tempo assistido` (+ testes)
5. `feat: botão com liberação por tempo assistido e memória local`
6. `feat: rodapé com aviso Meta e metadados noindex`
7. `chore: deploy com Caddy interno, compose para Komodo e docs`

## O que ainda preciso de você (pode ser depois, valores ficam provisórios)

- Título, subtítulo e texto do botão.
- ID do vídeo no YouTube e o segundo em que o botão deve aparecer.
- Uma imagem de capa vertical (9:16). A miniatura do YouTube para vídeo vertical sai com tarjas pretas.

## Verificação

- `pnpm -C frontend typecheck` (`tsc --noEmit`), `pnpm biome check` nos arquivos alterados e `pnpm -C frontend test` (Vitest: schema + timer + storage).
- `pnpm -C frontend build`, conferindo o tamanho do `out/` (meta: JS inicial < ~90KB gzip e HTML + CSS mínimos).
- Rodar `out/` localmente e conferir em 360/768/1280px: capa, play, pausa por toque, botão aparecendo no tempo, recarga com o botão já visível, foco visível e navegação por teclado.
- Lighthouse mobile (meta ≥ 95 em Performance, Acessibilidade e Boas práticas).
- `docker build` da imagem e `curl -I` no container para conferir headers e cache.
- `pnpm audit`.
- **Não verificável daqui:** DNS, HTTPS real em vsl.rastrewin.com, integração com o Caddy central e Komodo (você aplica o snippet e o compose).
