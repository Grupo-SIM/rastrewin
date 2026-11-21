# Plano — Afiliados por plataforma e link (SimIntPay + Rastrewin)

## Contexto

O Rastrewin quer vender por afiliados. Quem paga a comissão e quem guarda o cadastro dos afiliados é a **SimIntPay**, que já tem co-produção por plataforma e por link (`docs/coproduction.md`). O Rastrewin só captura o código do afiliado e o repassa ao checkout.

Estado atual na SimIntPay (`../simintpay`):

- **Co-produção:** acordo por produto e por plataforma, com participantes `{ email, percentageBps }`, base = líquido após taxas, versão otimista (409), snapshot gravado **antes** de cobrar, `CoproductionAllocation` por venda e beneficiário, estorno e chargeback sem recalcular. Herança: o link tem prioridade sobre a plataforma (`captureCoproduction` em `backend/src/modules/coproduction/coproduction.service.ts`).
- **Programa de afiliados atual** (`docs/superpowers/specs/2026-07-23-programa-afiliados-design.md`): outra coisa. É indicação de **contas** (`?ref=` no cadastro de Lead), comissão sobre `platformFee` (lucro da SimIntPay), % por afiliado definida pelo master. **Não é reaproveitado** nem alterado.
- **Tracking no checkout:** allowlist `utm_*`, `src`, `fbclid`, `fbc`, `fbp` em `checkout/src/lib/payment-tracking.ts` e `backend/src/modules/platform-core/payment-tracking.ts`. Não há campo de afiliado.

## Decisões (confirmar antes de implementar)

| Tema                   | Decisão proposta                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quem é afiliado        | Conta SimIntPay aprovada, adicionada pelo dono da plataforma (ou do link) **por e-mail**, como na co-produção. Recebe na carteira.                        |
| Onde se configura      | Tela de plataformas (padrão da plataforma) e formulário do link (sobrescreve a plataforma), novo bloco "Afiliados" ao lado de "Co-produção".              |
| Percentual global      | `defaultPercentageBps` da plataforma/link: vale para todo afiliado sem percentual próprio.                                                                |
| Percentual por pessoa  | `percentageBps` do afiliado: sobrescreve o global para ele.                                                                                               |
| Base                   | Líquido após taxas, em centavos, igual à co-produção. Sai da parte do dono.                                                                               |
| Identificação na venda | Código do afiliado (`aff`) no query do checkout, gravado na transação. Código vem de `Affiliate.code` (curto, único por plataforma/link), nunca o e-mail. |
| Afiliado fora da lista | Código desconhecido ou de afiliado removido: ignorado, sem comissão e sem erro no checkout.                                                               |
| Vínculo                | Último clique, janela de 30 dias, definida pelo Rastrewin ao guardar o código.                                                                            |
| Autoindicação          | Dono ou comprador igual ao afiliado: sem comissão.                                                                                                        |
| Renovação              | Só a primeira compra no início (pendente de confirmar).                                                                                                   |
| Soma                   | Afiliados + co-produtores não podem passar de 100% do líquido, validado ao salvar e na captura do snapshot.                                               |

## Pontos em aberto

- Comissão em renovações e assinaturas: a co-produção usa o snapshot original, então por padrão a renovação **herda** o afiliado. Confirmar se é desejado.
- O `ref` entra como cookie necessário ou só com consentimento (LGPD)? Hoje o `t.js` não guarda nada antes do aceite; ver `docs/business-rules.md` › Privacy. Se for necessário, atualizar a política e subir a versão do banner.
- O afiliado vê o percentual dos outros? Proposta: não (igual à co-produção).

## SimIntPay (`../simintpay`) — implementar primeiro

### Banco (migração aditiva, nada retroativo)

- `AffiliateAgreement` por `(scope, scopeId)` com `scope` em `plataformas` | `links-pagamento` | `links-assinatura` | `planos` | `planos-pix` | `boletos`, mesmos produtos da co-produção, com `mode` (`OWN`/`INHERIT`), `version`, `defaultPercentageBps` e `affiliates` (JSON: `userId`, `code`, `percentageBps?`), mais `AffiliateAgreementRevision` imutável para auditoria.
- `AffiliateAllocation` `(transactionId, userId)` com `amount` e `state` (`AVAILABLE`, `LOCKED`, `REVERSED`), espelhando `CoproductionAllocation`.
- Campo `affiliateCode` no tracking persistido da transação (não confiável: só chave de busca, nunca valor financeiro).
- Prefira reaproveitar `CoproductionAllocation` com `kind = AFFILIATE` se o liquidador permitir, para não duplicar `settleCoproduction`. Decidir na primeira tarefa depois de ler `coproduction-settlement.ts` por completo.

### Backend

- `GET/PUT /afiliados/:product/:id` e `GET/PUT /afiliados/plataformas/:platformId`, mesmo contrato da co-produção: configuração completa, `version` (409 em conflito), e-mails normalizados, sem duplicidade nem o próprio dono, soma ≤ 10000 bps junto com os co-produtores.
- `GET /afiliados/contas?search=&page=` reusa a busca de contas da co-produção.
- `paymentTracking` passa a aceitar `aff` (e `ref` como alias); `captureCoproduction` ganha o irmão `captureAffiliate`, chamado antes do gateway: resolve o código no acordo do link, senão da plataforma, e grava no snapshot o afiliado e o percentual efetivo (`percentageBps ?? defaultPercentageBps`). Sem código válido, não há snapshot.
- Liquidação: `COMPLETED` credita na carteira do afiliado (`nature: 'AFFILIATE'`), `IN_MEDIATION` bloqueia, `REFUNDED`/`CHARGEBACK` reverte o valor original. Idempotente por `(transactionId, userId)`.
- Relatórios do dono descontam a comissão do líquido; o afiliado ganha "Recebimentos de afiliado" e entra no dashboard como a co-produção.
- Evento `purchase_approved` da API de vendas passa a levar `affiliate: { code }` (sem e-mail nem valor de terceiros), para o track atribuir a venda.
- Atualizar `docs/central-sales-api.md`, `docs/business-rules.md` e criar `docs/afiliados.md`.

### Frontend

- Novo componente `AffiliatesDialog` ao lado de `components/coproduction/`, com linhas `percentual | conta | remover`, campo "Percentual global" no topo e código gerado por afiliado com botão copiar e link pronto (`https://rastrewin.com/?aff=CODE`).
- Plugar em `PlatformManager`/`PlatformSettingsModal` (padrão da plataforma) e nos formulários de link, com herança igual à co-produção ("Usar padrão da plataforma").
- Visão do afiliado: link, vendas, comissão pendente, creditada e revertida.

### Checkout (`checkout/`)

- `checkoutTracking` passa a encaminhar `aff`.

## Rastrewin (este repositório)

1. **`track` (`t.js` e captura)**: ler `aff` (e `ref`) da URL, guardar junto às UTMs no visitante (`visitors.affiliate_code`), janela de 30 dias, último clique. `aff` entra nos schemas públicos (`identify` e `event`, `track/src/lib/tracking/schemas.ts`) com limite de tamanho e formato `^[A-Za-z0-9_-]{3,40}$`, e em todo evento, como as UTMs, para o primeiro PageView também registrar a origem. Respeita o consentimento (ver ponto em aberto).
2. **`frontend`**: o formulário envia o código com o tracking do cadastro; `withTracking` (`frontend/lib/track.ts`) acrescenta `aff` na URL do checkout, como já faz com `src` e UTMs.
3. **`backend`**: guarda `aff` em `User.tracking` e o inclui no tracking do relay (o do checkout vence; o salvo no cadastro preenche o resto).
4. **`track` vendas e painel** (detalhe na seção abaixo).
5. **Docs**: `docs/business-rules.md` (Sales and attribution), `docs/development/simintpay.md` e a política de privacidade.

A venda do afiliado continua indo à Meta/GA4 como `Purchase`, inalterada.

## Track: diferenciar e filtrar vendas por afiliado

### Dados

- Migração Drizzle (próximo número em `track/drizzle/`): `visitors.affiliate_code`, `purchases.affiliate_code` e `purchases.affiliate_commission` (`numeric(14,2)`, nulo sem afiliado), com índice em `purchases.affiliate_code`. Tabelas já têm RLS forçada; coluna nova não exige `secure_table`, mas rodar `bun run test:rls`.
- `track/src/lib/sales/simintpay.ts`: o schema do evento passa a aceitar `affiliate: { code, commissionCents, name? }`. **A fonte de verdade é o `affiliate` do evento da SimIntPay** (ela decide quem recebe e quanto); `tracking.aff` só serve de reserva para a venda sem esse campo e nunca define comissão.
- Regra existente preservada: depois de aprovada, o afiliado e a comissão da venda ficam fixos. Reembolso, estorno e chargeback só mudam status e data; só uma nova aprovação do mesmo pedido pode atualizar esses campos. Comissão revertida fica visível no detalhe da venda, mas não reescreve a receita.
- Venda de visitante que não aceitou os cookies continua guardada e contada, agora com afiliado, vindo do evento da SimIntPay (que não depende de cookie).
- Retenção: o código do afiliado não é dado pessoal e permanece depois das limpezas, como UTMs e valor. Atualizar `RETENTION_DAYS`/docs só se algo mudar.

### Painel

- **Filtro "Afiliado"** (`SelectFilter` em `components/dashboard/filters.tsx`, estado na URL como `?afiliado=CODE`; vários valores como `?tipo=`; opções "Todos", "Sem afiliado" e cada código com nome quando houver). Vale em Faturamento, Visão geral, Páginas e Vídeos; em Campanhas não se aplica (é por anúncio da Meta, e o gasto não se divide por afiliado).
- **Faturamento**: coluna "Afiliado" em `purchases-table.tsx`, com filtro por código, e card "Por afiliado" (vendas, receita, comissão e líquido por código, ordenado por receita), seguindo a regra de renovações: receita conta tudo, números de aquisição só vendas novas.
- **Visão geral**: Receita, Compras, Conversão e funil respondem ao filtro; ROAS geral continua receita de vendas novas ÷ gasto, e o gasto não é filtrado (aviso no card quando há filtro de afiliado). Origens dos visitantes ganha o grupo "Afiliado · CODE" quando o visitante veio de afiliado.
- **Jornada do visitante**: mostra "Afiliado" em origem e atribuição (primeiro e último toque) e em cada compra.
- **Query**: um único helper `affiliateFilter(sp)` em `lib/dashboard/context.ts` aplicado em `revenue.ts`, `overview.ts` e `pages.ts`, para a regra ficar em um lugar só.
- Regra de negócio nova em `docs/business-rules.md` (Panel analytics) e `track/docs`.

## VSL

- **O botão fica limpo por padrão**: a atribuição passa pelo cookie `_trck` (vale em `.rastrewin.com`), então o `t.js` da VSL já registra o `aff` do link no visitante e o cadastro em rastrewin.com o herda.
- **Ajuste necessário só para quem recusa os cookies**: o destino do botão (`vsl/src/config/page-config.schema.ts` valida o host `rastrewin.com`) passa a repassar `aff` quando ele existe na URL da VSL, para não perder o afiliado de quem rejeitou o banner. O repasse é só `aff` (nenhuma UTM nem outro parâmetro) e é lido do próprio endereço da página, sem guardar nada.
- Como a VSL é estática, o `UnlockCta` (`vsl/src/components/vsl/unlock-cta.tsx`) vira componente de cliente só para ler `window.location.search` depois da hidratação; o `href` inicial continua o limpo, então nada muda sem `aff`.
- Valida `aff` com o mesmo formato do track e descarta o resto; sem teste novo de unidade além de estender `page-config.test.ts` se o schema mudar (suíte Vitest que já existe).
- Documentar em `vsl/AGENTS.md` e validar com `ui-screenshot-validation` (desktop e celular) porque o botão muda de componente.

## Ordem e commits

1. SimIntPay: migração e modelo (`feat(backend)`).
2. SimIntPay: endpoints, snapshot e liquidação, com testes de integração no PostgreSQL local (`feat(backend)`).
3. SimIntPay: tela de plataformas e links, e checkout (`feat(frontend)`, `feat(checkout)`).
4. Rastrewin: captura, repasse e relay (`feat(track)`, `feat(frontend)`, `feat(backend)`).
5. Track: migração, venda com afiliado e comissão (`feat(track)`).
6. Track: filtro, coluna, card "Por afiliado" e jornada (`feat(track)`).
7. VSL: repasse do `aff` no botão (`feat(vsl)`).
8. Docs (`docs`).

Nada vai para produção daqui: a SimIntPay aplica a migração e publica na ordem de `docs/coproduction.md` › Publicação.

## Progresso

- [ ] Decisões da tabela confirmadas
- [ ] SimIntPay: modelo
- [ ] SimIntPay: backend
- [ ] SimIntPay: frontend e checkout
- [ ] Rastrewin: captura e repasse
- [ ] Track: migração e venda com afiliado
- [ ] Track: filtro, coluna e card por afiliado
- [ ] VSL: repasse do `aff`
- [ ] Docs
