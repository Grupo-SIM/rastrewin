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

| Fase | Conteúdo                                                                | Status |
| ---- | ----------------------------------------------------------------------- | ------ |
| 1    | Fundação, design system, shell, Docker, CI                              | ✅     |
| 2    | Banco (Drizzle), papéis + RLS, pgcrypto, login (Better Auth)            | ✅     |
| 3    | Configurações pelo painel (contas, segredos mascarados, testar conexão) | ✅     |
| 4    | Captura: `/t.js`, `/api/identify`, `/api/event`, Meta CAPI              | ✅     |
| 5    | Webhook SimIntPay + GA4 Measurement Protocol                            | ✅     |
| 6    | Dashboard (visão geral, eventos, faturamento, geo)                      | ✅     |
| 7    | Campanhas (Meta Ads insights, cache, ROAS/CPA)                          | ✅     |
| 8    | Retenção (agendada pelo app), auditoria de segurança, go-live           | ✅     |

## Stack

- Next.js 16.4 (App Router, Turbopack, React 19.3, **Cache Components ligado**, React Compiler) — `output: "standalone"`.
    - Com Cache Components, leitura de cookies/headers/sessão/banco por request fica atrás de `<Suspense>`.
    - Middleware no Next 16 chama-se `proxy.ts`.
- Tailwind v4 + shadcn/ui (estilo `radix-nova`, primitivos **Radix**). `cn` vem do pacote `cn` (oficial do shadcn).
- Postgres 18 **oficial** (`postgres:18`, sem imagem própria nem pg_cron). `pgcrypto` vem incluído e é criado pela migration `0001`.
- Deploy: GitHub Actions (`.github/workflows/cd.yml` na raiz do monorepo) publica `ghcr.io/<owner>/rastrewin_track` (push na `main`, mensal e `workflow_dispatch`). O deploy em si é feito pelo usuário.

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

- Env do **app**: `DATABASE_URL` (usuário `app_login`), `ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, `APP_URL`.
  `MIGRATION_DATABASE_URL` (dono do banco) e `POSTGRES_*` são só da migração/compose — **nunca** vão para o container do app.
  **Nunca** `NEXT_PUBLIC_` com algo sensível. `.env` nunca é commitado. Env é lido de forma preguiçosa (`env()` em `src/lib/env.ts`) — o build roda sem env.
- Credenciais Meta/GA4/webhook ficam no banco, **cifradas com pgcrypto** (`src/lib/secrets.ts`: `encryptSecret`/`decryptSecret`/`secretHint`), em colunas `*_enc`.
- **Papéis do Postgres** (migration `drizzle/0001_security.sql`):
    - `app_login` — o app conecta com ele; NOINHERIT, sem privilégio próprio. Cada pool abre a conexão já no papel (`options: -c role=...`); não use `SET ROLE` em `pool.on("connect")` (corrida; removido no pg 9).
    - `app_service` — escrita. Use `serviceDb()` (`src/db/index.ts`) SÓ em código de servidor (API, server actions, auth).
    - `app_reader` — leitura do painel. RLS só libera linhas se `app.user_id` tiver sessão NÃO expirada (`app_private.has_valid_session()`), e não lê colunas `*_enc` nem tabelas de login.
- **RLS em todas as tabelas** (ligada e FORÇADA). Tabela nova → na migration: `SELECT app_private.secure_table('public.x', true);` e rode `bun run test:rls` (falha se alguma tabela ficar sem RLS).
- **Leitura no painel SEMPRE via `readAsUser()`** (`src/lib/dal.ts`): valida a sessão no servidor e consulta como `app_reader`.
  O `proxy.ts` e o `<SessionGate>` do layout são só UX: com Cache Components, o texto **estático** de uma página pode ir no HTML pré-renderizado. Nunca coloque dado sensível em parte estática.
- Em código que roda no render, chame `headers()`/`cookies()` ANTES de `getAuth()`/`serviceDb()` (senão o build tenta ler o env).
- Cadastro público **desligado** (Better Auth `disableSignUp`); usuários só via `create-admin`. Login com rate limit (5 tentativas/min).
- Endpoints públicos: validação Zod + limite de corpo + rate limit + CORS restrito. Webhook do SimIntPay: assinatura HMAC-SHA256 do corpo em `x-simintpay-signature` (comparação em tempo constante).
- **Erros e logs:** a mensagem de erro do Drizzle traz os PARÂMETROS da query (inclui a `ENCRYPTION_KEY`, tokens e PII). Logue/grave erros SÓ com `safeErrorMessage()` (`src/lib/errors.ts`); escrita que cifra segredo fica em try/catch → `dbError()`. Rede de segurança: `installLogRedaction()` no `instrumentation.ts` troca os segredos do env por `[REDACTED]` no stdout/stderr.
- Modelo de ameaça, riscos aceitos e checklist de produção: [SECURITY.md](SECURITY.md).

## Configurações (Fase 3)

- Tela: `src/app/painel/config/` (page + `actions.ts`); componentes em `src/components/config/`.
- Leitura: `getConfigView()` (`src/lib/config/queries.ts`) via `readAsUser` — só colunas não secretas + pista (`••••abcd`).
- Escrita: Server Actions em `actions.ts`. **Toda action chama `requireSession()` e valida com Zod** (`src/lib/config/validation.ts`), escreve com `serviceDb()` e termina com `refresh()`.
- Segredo em branco na edição = manter o atual. Editar só o nome mantém o resultado do último teste; trocar ID/segredo zera.
- Segredo do webhook: gerado no servidor e mostrado **uma única vez** (ou colado manualmente). Nunca há "revelar".
- "Testar conexão" (`src/lib/config/connection-tests.ts`):
    - Pixel: `POST /{pixel_id}/events` com `data: []` — a Meta valida token e permissão ANTES do corpo; "param data must be non-empty" = OK. Nenhum evento é criado.
      (Não use `GET /{pixel_id}`: o token da Conversions API costuma não ter permissão de leitura → "(#100) Missing Permission" mesmo funcionando para envio.)
    - Contas de anúncio: `GET /act_{id}?fields=name,account_status,currency`.
    - GA4: servidor de validação `/debug/mp/collect`. Ele **não valida o api_secret** → resultado "Atenção" (confirmar no DebugView).
- Cliente da Graph API: `src/lib/meta/graph.ts` (token em `access_token`, timeout 10s, sem logar token; captura headers de uso para o rate limit da Fase 7).

## Captura (Fase 4)

- **Script do site:** fonte em `src/tracker/trck.ts` → `bun run tracker:build` gera `public/t.js` (roda sozinho no `predev`/`prebuild`; o arquivo gerado não vai para o git).
    - Lê `/api/config/public` (só IDs públicos, só para origens autorizadas), carrega Pixel + gtag das contas ativas, mantém `trck_user_id` (cookie `_trck` no domínio raiz + localStorage), gera `_fbp`/`_fbc`, guarda UTMs (última origem, 90 dias), lê `client_id`/`session_id` via `gtag('get')` (fallback: cookies `_ga` e `_ga_*` GS1/GS2).
    - Decora links de checkout (`src`=trck_user_id + UTMs + fbc/fbp, que o SimIntPay repassa) e WhatsApp (`Ref: <id>` na mensagem). Cliques disparam InitiateCheckout/Contact (desliga com `data-no-auto`).
    - `trck('track', nome, dados)` → Pixel (`eventID`) + gtag + `/api/event` com o MESMO event_id. `Purchase` é recusado (só webhook).
    - Dados do `identify` vão junto nos eventos seguintes da página (evita corrida).
- **Endpoints públicos** (`src/app/api/identify`, `src/app/api/event`, `src/app/api/config/public`): origem (CORS via `allowed_origins`) → rate limit → limite de corpo → Zod (`src/lib/tracking/schemas.ts`). IP/UA/geo sempre do servidor.
    - Limites: identify 30/min (burst 15), event 120/min (burst 40), por IP. Corpo: 8 KB / 16 KB.
    - `/api/event` responde 202 e envia à Meta em `after()`; dedup por `event_id` (repetido → `duplicate: true`, sem reenvio).
- **Proxy reverso obrigatório em produção** (Caddy/nginx de `deploy/`): o IP vem SÓ do `X-Real-IP` que o proxy sobrescreve, ou do ÚLTIMO IP do `X-Forwarded-For` (`src/lib/http/client-ip.ts`, regra única para geo, Meta, rate limit e login). `cf-connecting-ip` é ignorado (forjável sem Cloudflare). Ver Fase 8.
- **Config em memória** (`src/lib/tracking/runtime-config.ts`): cache de 30 s com tokens decifrados; as actions de Configurações chamam `invalidateRuntimeConfig()`.
- **Meta CAPI:** `src/lib/meta/capi.ts` (montagem + envio a TODOS os pixels ativos); normalização/hash em `src/lib/tracking/normalize.ts` (telefone BR sem DDI ganha 55; com `+`/`00` mantém).
- **Geo:** `src/lib/geo` lê `data/geo/dbip-city-lite.mmdb` (DB-IP Lite, **CC BY 4.0 — manter a atribuição no rodapé do painel**). `bun run geo:download` (local); no Docker, estágio `geo` (o CI roda todo mês para atualizar). `geo_region` = UF no Brasil.
- **Testes unitários:** `bun run test` (node:test via tsx, `--conditions=react-server` por causa do `server-only`). Arquivos `*.test.ts` ao lado do código.

## Vendas (Fase 5)

- **Contrato SimIntPay** ("API de vendas"): POST com JSON exato + `x-simintpay-signature` = HMAC-SHA256 hex do corpo bruto com o segredo do webhook (`settings.webhook_token_enc`). Eventos: purchase_approved, purchase_refunded, chargeback, refund_requested, card_declined, pix_generated, pix_expired. Valores em CENTAVOS, sem moeda (usa `settings.currency`). Fonte: `Grupo-SIM/simintpay` → `docs/central-sales-api.md` e `backend/src/modules/platform-core/platform-sales-events.service.ts`.
- **Endpoint** `src/app/api/webhook/compra/route.ts`: rate limit → corpo ≤ 64 KB → segredo configurado (senão 503) → assinatura (`src/lib/sales/signature.ts`; inválida = 401, nada gravado) → Zod (`src/lib/sales/simintpay.ts`) → idempotência por `eventId` (`webhook_events`) → UPSERT por `transaction_id` (`src/lib/sales/process.ts`) → 200; envios em `after()`.
- **Status com precedência** (`nextStatus`): pending/declined/expired < approved/refund_requested < refunded/chargeback. Evento atrasado não desfaz reembolso.
- **Atualização preserva dados:** eventos seguintes (reembolso etc.) vêm sem tracking/email — só campos com valor sobrescrevem; UTMs trocam só em conjunto.
- **Ligação venda → visitante** (`matchVisitor`): `tracking.src` (formato trck_user_id) → hash do email → hash do telefone. Resultado em `purchases.match`.
- **Envio** (`src/lib/sales/deliver.ts`, função única para webhook e reenvio; trava em memória por compra):
    - Meta: `Purchase`, `event_id = purchase_<transactionId>`, valor BRUTO; `action_source` = website (com UA do visitante) ou `system_generated` (sem visitante); até 7 dias.
    - GA4 (`src/lib/ga4/mp.ts`): `purchase` com `client_id`/`session_id` da visita (sem visitante: client_id sintético estável), `timestamp_micros` até 72 h; **sem campo consent** (decisão do usuário; reavaliar com aviso de cookies/LGPD).
    - Reembolso/chargeback → `refund` ao GA4 (só se a compra foi enviada; mesmo client_id). Meta não recebe reembolso.
    - Modo debug do GA4 (`settings.ga4_debug`): valida no /debug/mp/collect e envia com `debug_mode`.
- **Reenvio automático:** `src/instrumentation.ts` → `src/lib/sales/retry.ts` a cada 5 min (não roda no build nem sem `DATABASE_URL`); até 5 tentativas por destino, últimos 7 dias.
- **Fuso horário do painel:** `settings.timezone` (IANA, padrão Brasília), escolhido em Configurações › Geral; formatação em `src/lib/time.ts`. Deve ser o MESMO da conta de anúncios: a conta do usuário está em **America/Sao_Paulo** (manter o padrão). Só o computador dele está no fuso do Acre — o Gerenciador de Eventos e o DebugView mostram o horário local de quem olha.

## Dashboard (Fase 6)

- **Consultas** em `src/lib/dashboard/` — todas dentro de `withDashboard()` (`context.ts`): UMA transação `readAsUser` (RLS), lê fuso/moeda e resolve o período da URL (`period.ts`, padrão 30d; presets hoje/ontem/7d/30d/90d/mês/personalizado). Agregações em SQL; dias agrupados com `at time zone <fuso do painel>`.
- **Definições** (mostradas no ⓘ de cada KPI): usuários únicos = trck_user_id distintos com evento no período; compras = status approved/refund_requested por `occurred_at`; conversão = compras ÷ usuários; receita = soma do valor BRUTO; reembolsos por `refunded_at`.
    - **Funil por PESSOAS**: Visitou (PageView) ⊇ Checkout (InitiateCheckout entre quem visitou) ⊇ Comprou (compradores entre os do checkout). Compras sem ligação/checkout aparecem numa nota (nunca passa de 100%).
    - Deltas: período anterior de mesmo tamanho.
- **Detalhes** (payload/resposta Meta e GA4, webhook bruto) só ao abrir o modal: Server Actions `src/app/painel/{eventos,faturamento}/actions.ts` → `src/lib/dashboard/details.ts` (readAsUser).
- **Gráficos** (`src/components/charts/`, skill dataviz): um eixo por gráfico; cor por papel/entidade; todo gráfico tem "Ver tabela"; filtros numa linha (`src/components/dashboard/filters.tsx`, estado na URL, conteúdo esmaece ao recarregar). Componentes cliente não recebem funções do servidor — use `kind: "int" | "money"`.
- **Paleta de gráficos** (`--viz-*` em `globals.css`, validada com `validate_palette.js` nas superfícies reais #fdfefd / #0b120f): claro `#159946,#098faa,#c37e05,#5b17cf,#d0255e`; escuro `#18af4f,#0aa3c1,#c88005,#a274f0,#ea5587` (ordem fixa verde→ciano→âmbar→violeta→rosa). O neon da UI é claro demais para gráfico no escuro — não use `--primary` em marcas de dados. Funil: `--viz-fun-*` (validado com `--ordinal`); mapa: `--viz-seq-*`; status: `--status-*` (sempre com ícone + rótulo).
- **Mapa**: `react-simple-maps` + malha oficial do IBGE (`src/components/charts/geo/br-uf.topo.json`, códigos IBGE → UF em `src/lib/geo/br-states.ts`). Créditos "Malha: IBGE" e DB-IP no rodapé.
- KPIs: número nunca quebra; fonte reduz conforme o tamanho do valor no celular.

## Campanhas (Fase 7)

- **Convenção de UTM** (o SimIntPay só repassa utm_*/src/fbc/fbp, então o ID vai DENTRO da UTM). Parâmetros de URL dos anúncios (texto em `src/components/campaigns/utm-guide.tsx`):
  `utm_source={{site_source_name}}&utm_medium=paid&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_term={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}`
  Em 03/11/2026 a conta do usuário (act_269366881996053) NÃO tinha url_tags — ele precisa configurar.
- **Atribuição** (`src/lib/campaigns/build.ts`, puro/testado): ID do anúncio (fim do utm_content) > ID do conjunto (utm_term) > ID da campanha (utm_campaign) > nome da campanha. Sem match → "Sem campanha identificada" (só na visão "todas as contas"). ROAS = receita BRUTA ÷ gasto; CPA = gasto ÷ vendas atribuídas. Ao lado, compras que a própria Meta reporta (use_unified_attribution_setting=true).
- **Insights** (`src/lib/meta/insights.ts`): uma chamada por conta e período, `level=ad`, diário se ≤ 90 dias, paginação até 10 páginas.
- **Cache + limite** (`src/lib/campaigns/cache.ts`, `limiter.ts`): tabela `meta_insights_cache`; válido 1 h (período com hoje) / 12 h (passado); vencido → mostra cache e atualiza em `after()`. Limite próprio por conta: ≥ 10 s entre chamadas, ≤ 20/h, pausa de 15 min se uso da Meta > 50% ou erro de limite; "Atualizar agora" a cada 15 min. Chamada que nem chegou à Meta (rede/abortada) não conta. Conta em `development_access` (600 pontos/h na Meta).
- **IMPORTANTE (Next 16 + partialPrefetching):** a página pode ser pré-renderizada no request e o Next ABORTA I/O dessa renderização. Antes de efeitos colaterais/chamadas externas no render, use `await connection()` (feito em `src/lib/campaigns/query.ts`) — sem isso a chamada à Meta era disparada, abortada e consumia o limite.
- Tabela da árvore: Impressões e CTR somem abaixo de 1400 px para caber sem rolagem.

## Retenção, segurança e go-live (Fase 8)

- **Limpeza diária** (procedure em `drizzle/0005_retention.sql`/`0006`) **agendada pelo APP, sem pg_cron**: `src/lib/maintenance/scheduler.ts` (ligado no `instrumentation.ts`) confere a cada 15 min e chama `runRetentionIfDue()` (`src/lib/maintenance/retention.ts`).
    - Roda uma vez por dia a partir das **03:15 Brasília** (06:15 UTC). Se o app estava fora do ar no horário, roda quando voltar; após falha, tenta de novo em 1 h.
    - Executa como **app_service** (único papel com EXECUTE; ele já podia alterar essas linhas) com trava `pg_try_advisory_lock(726401115)` numa conexão dedicada: nunca duas ao mesmo tempo, nem com várias instâncias. A trava é liberada no `finally`; se falhar, a conexão é descartada.
    - Zera `payload_meta/response_meta/payload_ga4/response_ga4` do `events_log` com mais de 14 dias, em lotes de 5.000 com COMMIT (a linha fica). Índice parcial `events_log_retention_idx` só cobre linhas com payload.
    - Também apaga sessões/verificações vencidas há 1 dia e `meta_insights_cache` com 30+ dias. Registra cada execução em `maintenance_runs` (painel: Configurações › Geral › "Manutenção e servidor").
    - É PROCEDURE sem SECURITY DEFINER e sem `SET search_path` (os dois impedem COMMIT): todo nome é qualificado com schema. Policies `owner_maintenance` só para o dono (caso ele não seja superusuário).
    - Teste: `bun run test:retention` (procedure + executor pela conexão real do app). Rodar à mão: `CALL app_private.run_retention();`. Logs: `docker compose logs app | grep retenção`. Histórico: tabela `maintenance_runs`.
- **IP confiável:** o app só confia no `X-Real-IP` sobrescrito pelo proxy da mesma VPS; a porta 3000 fica em `127.0.0.1` (compose). O cartão de Manutenção mostra o IP visto e alerta "Proxy sem X-Real-IP".
- **CSP** (`next.config.ts`): sem nonce (nonce é incompatível com Cache Components/PPR), então `script-src 'self' 'unsafe-inline'`; vale para as páginas, fora de `/api` e `/t.js`. Recurso externo novo no painel (fonte, imagem, API chamada do navegador) precisa entrar na CSP.
- **Go-live:** `docs/go-live.md` (VPS + Caddy ou nginx), arquivos em `deploy/` (compose só com imagens do GHCR, `Caddyfile`, `nginx.conf`). A URL do webhook (`https://track.rastrewin.com/api/webhook/compra`) e o segredo são cadastrados pelo time do SimIntPay (`WEBHOOK_URL`/`WEBHOOK_SECRET` da integração da plataforma).

## Regras de tracking (não quebrar)

- Meta CAPI: SHA-256 em em/ph(só dígitos)/fn/ln/ct/st/country/external_id. **Não** hashear fbp, fbc, IP, user_agent. Sempre IP+UA, `action_source: "website"`, `event_id` igual ao do Pixel.
- GA4: eventos web via **gtag no navegador** (measurement_id vindo da config). Measurement Protocol **só** para a compra do webhook, com o mesmo `client_id`/`session_id`. Nunca duplicar no MP o que a gtag já enviou.
- Eventos vão para **todos** os destinos ativos; a resposta de cada destino fica no log.

## Banco e migrations

- Schema em `src/db/schema/` (`app.ts` = nossas tabelas; `auth.ts` = gerado pelo Better Auth, com ajuste de timezone).
- `bun run db:generate` gera SQL em `drizzle/` a partir do schema. SQL de segurança é migration custom: `bun run db:generate --custom --name=<nome>`.
- `bun run db:migrate` aplica as migrations como dono do banco e sincroniza a senha do `app_login` a partir da `DATABASE_URL`.

## Comandos

```bash
docker compose up -d db          # Postgres local (postgres:18 oficial)
bun run db:migrate               # aplica migrations (papéis, RLS)
bun run create-admin -- --email voce@empresa.com --name "Seu Nome"   # pede a senha sem mostrar
bun run delete-user -- --email voce@empresa.com                      # apaga usuário (e sessões)
bun run test:rls                 # 30 verificações de segurança do banco
bun run test:retention           # limpeza diária — procedure + executor do app, de verdade
bun run geo:download             # base de geolocalização (uma vez; ~127 MB em data/geo)
bun run test                         # testes unitários (normalização/hash, IP, rate limit, CAPI, validação)
bun run dev                      # desenvolvimento (http://localhost:3000)
bun run build                    # build de produção (gera .next/standalone)
bun run lint && bun run check-types
```

O `bun run build` local lê o `.env`; o Docker/CI não. Para reproduzir o CI: `docker compose build app`.

Produção (imagem do GHCR):

```bash
docker compose up -d db
docker compose --profile tools run --rm migrate
docker compose run --rm -it app node scripts/create-admin.mjs --email voce@empresa.com --name "Seu Nome"
docker compose up -d app
```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
