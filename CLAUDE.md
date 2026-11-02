# CLAUDE.md — Rastrewin (tracking server-side)

@AGENTS.md

## Como trabalhamos
- O usuário orienta em **português**. Responder e escrever UI/comentários em pt-BR.
- Construção **em fases**. No fim de cada fase: build/lint/typecheck ok → **commit** → **parar e esperar aprovação**.
- Plano aprovado: `~/.claude/plans/pasted-content-id-5b95-voc-iterative-wand.md`.
- **Versões:** sempre a mais recente de cada lib/API. Conferir a doc oficial antes de integrar.
  - Next.js: ler o guia em `node_modules/next/dist/docs/` antes de usar uma API (ver AGENTS.md).
  - API com versão na URL fica numa **constante única**:
    - Meta Graph/Marketing API → `src/lib/meta/version.ts` (`META_GRAPH_VERSION`, hoje `v26.0`)
    - GA4 Measurement Protocol → `src/lib/ga4/endpoints.ts`

## Status das fases
| Fase | Conteúdo | Status |
|---|---|---|
| 1 | Fundação, design system, shell, Docker, CI | ✅ |
| 2 | Banco (Drizzle), papéis + RLS, pgcrypto, login (Better Auth) | ⏳ |
| 3 | Configurações pelo painel (contas, segredos mascarados, testar conexão) | ⏳ |
| 4 | Captura: `/t.js`, `/api/identify`, `/api/event`, Meta CAPI | ⏳ |
| 5 | Webhook SimIntPay + GA4 Measurement Protocol | ⏳ |
| 6 | Dashboard (visão geral, eventos, faturamento, geo) | ⏳ |
| 7 | Campanhas (Meta Ads insights, cache, ROAS/CPA) | ⏳ |
| 8 | Retenção (pg_cron), auditoria de segurança, go-live | ⏳ |

## Stack
- Next.js 16.4 (App Router, Turbopack, React 19.3, **Cache Components ligado**, React Compiler) — `output: "standalone"`.
  - Com Cache Components, leitura de cookies/headers/sessão/banco por request fica atrás de `<Suspense>`.
  - Middleware no Next 16 chama-se `proxy.ts`.
- Tailwind v4 + shadcn/ui (estilo `radix-nova`, primitivos **Radix**). `cn` vem do pacote `cn` (oficial do shadcn).
- Postgres 18 próprio (Docker) com `pgcrypto` e `pg_cron` — imagem em `docker/postgres/`.
- Deploy: GitHub Actions (`.github/workflows/build.yml`) publica `ghcr.io/<owner>/rastrewin` e `ghcr.io/<owner>/rastrewin-postgres` (push na `main`, tags `v*` e `workflow_dispatch`). O deploy em si é feito pelo usuário.

## Design system (`src/app/globals.css`)
- Cores em **HSL** nas variáveis de `:root` (claro) e `.dark` (escuro, **padrão**). Mudar paleta só ali.
  - Primária verde-neon: escuro `142 76% 58%`, claro `142 70% 26%`. Accents `--cyan` e `--amber` (classes `text-cyan`, `bg-amber/10`...).
  - `--radius: 0.625rem`. Fundo: gradiente radial + ruído SVG (`body::before/::after`).
- Fontes: Manrope (`font-sans`) e JetBrains Mono (`font-mono`). Números tabulares no body; use a classe `.num` em valores/KPIs.
- Componentes do painel: `GlassCard` (card translúcido com blur), `KpiCard`, `PageHeader`, `EmptyState`. Classe `.glass` para superfícies fora de Card.
- **Mobile-first**: sidebar só em `lg+`; no celular, topbar + barra inferior (`MobileNav`) com "Mais". Alvos de toque ≥ 44px.
- Navegação: editar `src/components/shell/nav-items.ts`.
- Gráficos: Recharts. Mapa: react-simple-maps. Ler a skill `dataviz` antes de criar gráficos.

## Segurança (regras fixas)
- Env só tem: `DATABASE_URL`, `ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, `APP_URL` (+ `POSTGRES_*` do compose). **Nunca** `NEXT_PUBLIC_` com algo sensível. `.env` nunca é commitado.
- Credenciais Meta/GA4/webhook ficam no banco, **cifradas com pgcrypto**, editadas pelo painel e lidas só no servidor.
- RLS em **todas** as tabelas: leitura só pelo papel `app_reader` com sessão validada; escrita só por `app_service` (código de servidor).
- Cadastro público **desligado**; admin criado via `npm run create-admin`.
- Endpoints públicos: validação Zod + limite de corpo + rate limit + CORS restrito. Webhook exige token (comparação em tempo constante).

## Regras de tracking (não quebrar)
- Meta CAPI: SHA-256 em em/ph(só dígitos)/fn/ln/ct/st/country/external_id. **Não** hashear fbp, fbc, IP, user_agent. Sempre IP+UA, `action_source: "website"`, `event_id` igual ao do Pixel.
- GA4: eventos web via **gtag no navegador** (measurement_id vindo da config). Measurement Protocol **só** para a compra do webhook, com o mesmo `client_id`/`session_id`. Nunca duplicar no MP o que a gtag já enviou.
- Eventos vão para **todos** os destinos ativos; a resposta de cada destino fica no log.

## Comandos
```bash
npm run dev          # desenvolvimento
npm run build        # build de produção (gera .next/standalone)
npm run lint
npx tsc --noEmit     # typecheck (rode `npx next typegen` se faltar tipos de rotas)
docker compose up -d --build   # app + Postgres local
```
