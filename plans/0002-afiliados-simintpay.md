# Plano — Afiliados por plataforma e oferta (SimIntPay + Rastrewin)

## Contexto

O Rastrewin quer vender por afiliados. Quem paga a comissão e quem guarda o cadastro dos afiliados é a **SimIntPay**, que já tem co-produção por plataforma e por oferta (`docs/coproduction.md`). O Rastrewin só captura o código do afiliado e o repassa ao checkout.

Os afiliados valem **para toda a plataforma**: servem para compras feitas por oferta (checkout, assinatura e renovação) e por API (`/platforms/:tag/payments`).

Estado atual na SimIntPay (`../simintpay`):

- **Co-produção:** só dois produtos hoje, `plataformas` e `ofertas` (`productTables` em `backend/src/modules/coproduction/coproduction.ts`; os produtos legados viraram ofertas). Acordo com participantes `{ email, percentageBps }`, base = líquido após taxas, versão otimista (409), snapshot gravado **antes** de cobrar, `CoproductionAllocation` por venda e beneficiário, estorno e chargeback sem recalcular. Na co-produção, o acordo `OWN` da oferta **substitui** o da plataforma (`captureCoproduction` em `coproduction.service.ts`). Chamadores: `unified-platform/payments/platform-payments.service.ts` (API), `offer/offer-checkout.service.ts`, `offer-subscribe.service.ts`, `offer-renewal.service.ts`, `billing-core/cycle-ledger.ts` e `platform-core/ebook-enrollment.ts`.
- **Programa de afiliados atual** (`docs/superpowers/specs/2026-07-23-programa-afiliados-design.md`): outra coisa. É indicação de **contas** (`?ref=` no cadastro de Lead), comissão sobre `platformFee` (lucro da SimIntPay), % por afiliado definida pelo master. **Não é reaproveitado** nem alterado.
- **Tracking no checkout:** allowlist `utm_*`, `src`, `fbclid`, `fbc`, `fbp` em `checkout/src/lib/payment-tracking.ts` e `backend/src/modules/platform-core/payment-tracking.ts`. Não há campo de afiliado.

## Decisões (confirmar antes de implementar)

| Tema                   | Decisão proposta                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Quem é afiliado        | Conta SimIntPay aprovada, adicionada pelo dono da plataforma (ou da oferta) **por e-mail**, como na co-produção. Recebe na carteira.                                                             |
| Onde se configura      | Tela de plataformas (afiliados da plataforma inteira) e formulário da oferta, novo bloco "Afiliados" ao lado de "Co-produção".                                                                   |
| Alcance                | Afiliado da plataforma vale em **toda** compra dela, por oferta ou por API. Afiliado da oferta vale só naquela oferta.                                                                           |
| Plataforma × oferta    | **Soma, não substitui** (diferente da co-produção). Vale a união das duas listas; se a mesma pessoa está nas duas, vale o percentual **da oferta**.                                              |
| Percentual global      | `defaultPercentageBps` da plataforma (e, opcional, da oferta): vale para todo afiliado sem percentual próprio. Na oferta, o global dela vence o da plataforma.                                   |
| Percentual por pessoa  | `percentageBps` do afiliado: sobrescreve o global. Ordem de precedência, da mais forte: pessoa na oferta, global da oferta, pessoa na plataforma, global da plataforma.                          |
| Base                   | Líquido após taxas, em centavos, igual à co-produção. Sai da parte do dono.                                                                                                                      |
| Identificação na venda | Código do afiliado (`aff`) no query do checkout ou no `tracking` da chamada de API, gravado na transação. O código é único **por plataforma** e nunca é o e-mail.                                |
| Afiliado fora da lista | Código desconhecido ou de afiliado removido: ignorado, sem comissão e sem erro no checkout.                                                                                                      |
| Vínculo                | Último clique, janela de 30 dias, definida pelo Rastrewin ao guardar o código.                                                                                                                   |
| Consentimento          | `aff` é **cookie necessário** (`_trck_aff`, 30 dias, só o código, sem id de visitante): grava antes do aceite do banner. Ver "LGPD" abaixo.                                                      |
| Autoindicação          | Dono ou comprador igual ao afiliado: sem comissão.                                                                                                                                               |
| Renovação              | Opção `commissionOnRenewals` na plataforma e na oferta. **Padrão: todas as renovações.** Desmarcada: só a primeira compra. A da oferta vence a da plataforma. O valor fica no snapshot da venda. |
| Soma                   | Afiliados + co-produtores não podem passar de 100% do líquido, validado ao salvar e na captura do snapshot.                                                                                      |

## Pontos em aberto

- O afiliado vê o percentual dos outros? Proposta: não (igual à co-produção).
- A opção de renovação, quando o dono muda depois: vale para vendas futuras; o snapshot de cada venda não muda (as renovações de uma assinatura já criada seguem o snapshot dela). Confirmar se o dono espera o contrário.

Resolvido: afiliados valem para a plataforma toda (oferta e API); plataforma e oferta somam e o percentual da oferta vence na mesma pessoa; `aff` é cookie necessário; renovação é opção com padrão "todas".

## LGPD (cookie necessário)

- Hoje o `t.js` não grava nada antes do aceite (`docs/business-rules.md` › Privacy). Passa a haver **uma exceção**: o cookie `_trck_aff` em `.rastrewin.com` (30 dias, `Secure`, `SameSite=Lax`), com **só o código do afiliado**, sem id de visitante, sem UTMs e sem dado pessoal. Serve ao contrato de afiliação (pagar a comissão devida) e entra na categoria "necessários".
- Ele sobrevive à rejeição e à revogação do banner. Sem consentimento, o código **não** vai ao visitante do track nem à Meta/GA4; só é enviado à SimIntPay com o checkout, e o track o recebe de volta no evento da venda.
- A política de privacidade (`frontend/app/privacidade/page.tsx`) ganha a linha na tabela de cookies e a base legal; a versão do texto do banner sobe no painel do track (todos são perguntados de novo). As duas versões precisam bater, como já exige a regra existente.
- Validar com o jurídico antes de publicar: é uma decisão de base legal, não técnica.

## SimIntPay (`../simintpay`) — implementar primeiro

### Banco (migração aditiva, nada retroativo)

- `AffiliateAgreement` por `(product, productId)` com `product` em `plataformas` | `ofertas` (os mesmos dois da co-produção), `version`, `defaultPercentageBps?`, `commissionOnRenewals` (padrão `true`) e `affiliates` (JSON: `userId`, `code`, `percentageBps?`), mais `AffiliateAgreementRevision` imutável para auditoria. Não há `mode: INHERIT`: plataforma e oferta sempre somam.
- `AffiliateAllocation` `(transactionId, userId)` com `amount` e `state` (`AVAILABLE`, `LOCKED`, `REVERSED`), espelhando `CoproductionAllocation`.
- Campo `affiliateCode` no tracking persistido da transação (não confiável: só chave de busca, nunca valor financeiro).
- Snapshot da venda guarda o afiliado resolvido, o percentual efetivo, de qual nível veio (`offer` ou `platform`), a versão dos dois acordos e `commissionOnRenewals` efetivo.
- Prefira reaproveitar `CoproductionAllocation` com `kind = AFFILIATE` se o liquidador permitir, para não duplicar `settleCoproduction`. Decidir na primeira tarefa depois de ler `coproduction-settlement.ts` por completo.

### Backend

- `GET/PUT /afiliados/ofertas/:id` e `GET/PUT /afiliados/plataformas/:platformId`, mesmo contrato da co-produção: configuração completa, `version` (409 em conflito), e-mails normalizados, sem duplicidade nem o próprio dono. Só dono aprovado ou admin ativo; token de integração não configura.
- Validação de soma: para qualquer venda possível, afiliado efetivo + co-produtores ≤ 10000 bps. Como plataforma e oferta somam, o PUT calcula o pior caso (soma dos maiores percentuais das duas listas) e rejeita acima de 100%; a captura do snapshot revalida.
- `GET /afiliados/contas?search=&page=` reusa a busca de contas da co-produção.
- `paymentTracking` passa a aceitar `aff` (e `ref` como alias) tanto no checkout quanto no `tracking` de `/platforms/:tag/payments`; `captureAffiliate` roda ao lado de `captureCoproduction`, **em todos os chamadores listados no Contexto**, antes do gateway. Resolve o código na lista da oferta e na da plataforma; se o código existe nas duas, vale o da oferta. O percentual efetivo segue a precedência da tabela de decisões. Sem código válido, não há snapshot.
- Renovação (`offer-renewal.service.ts`, `cycle-ledger.ts`): usa o snapshot original; se `commissionOnRenewals` for `false`, não gera alocação. Renovação fica marcada na alocação para o relatório.
- Liquidação: `COMPLETED` credita na carteira do afiliado (`nature: 'AFFILIATE'`), `IN_MEDIATION` bloqueia, `REFUNDED`/`CHARGEBACK` reverte o valor original. Idempotente por `(transactionId, userId)`.
- Relatórios do dono descontam a comissão do líquido; o afiliado ganha "Recebimentos de afiliado" e entra no dashboard como a co-produção.
- Evento `purchase_approved` da API de vendas passa a levar `affiliate: { code, commissionCents, name? }` (sem e-mail nem valores de terceiros), para o track atribuir a venda. Renovação sem comissão (opção desmarcada) vai sem `affiliate`.
- Atualizar `docs/central-sales-api.md`, `docs/business-rules.md` e criar `docs/afiliados.md`.

### Frontend

- Novo componente `AffiliatesDialog` ao lado de `components/coproduction/`, com linhas `percentual | conta | remover`, campo "Percentual global" no topo, opção "Comissão nas renovações" (marcada por padrão) e código gerado por afiliado com botão copiar e link pronto (`https://rastrewin.com/?aff=CODE`).
- Plugar em `PlatformManager`/`PlatformSettingsModal` (afiliados da plataforma inteira) e no formulário da oferta. Na oferta, mostrar também, somente leitura, os afiliados herdados da plataforma, com aviso "o percentual da oferta vale em vez do da plataforma" quando a mesma pessoa está nas duas listas. A opção de renovação da oferta tem "Usar a da plataforma".
- Visão do afiliado: link, vendas, comissão pendente, creditada e revertida.

### Checkout (`checkout/`)

- `checkoutTracking` passa a encaminhar `aff`.

## Rastrewin (este repositório)

1. **`track` (`t.js` e captura)**: ler `aff` (e `ref`) da URL **antes de qualquer consentimento** e gravar o cookie necessário `_trck_aff` (30 dias, último clique, formato `^[A-Za-z0-9_-]{3,40}$`). Só com consentimento o código também vai ao visitante (`visitors.affiliate_code`) e a todo evento, como as UTMs (`track/src/lib/tracking/schemas.ts`, `identify` e `event`). Sem consentimento o `t.js` continua descartando `identify`, `event` e `video`; o código só segue pelo cookie.
2. **`frontend`**: o formulário e o `withTracking` (`frontend/lib/track.ts`) leem o cookie `_trck_aff` direto, sem depender do `t.js` nem do consentimento, e enviam `aff` com o cadastro e na URL do checkout.
3. **`backend`**: guarda `aff` em `User.tracking` e o inclui no tracking do relay (o do checkout vence; o salvo no cadastro preenche o resto).
4. **`track` vendas e painel** (detalhe na seção abaixo).
5. **Docs**: `docs/business-rules.md` (Sales and attribution), `docs/development/simintpay.md` e a política de privacidade.

A venda do afiliado continua indo à Meta/GA4 como `Purchase`, inalterada.

## Track: diferenciar e filtrar vendas por afiliado

### Dados

- Migração Drizzle (próximo número em `track/drizzle/`): `visitors.affiliate_code`, `purchases.affiliate_code` e `purchases.affiliate_commission` (`numeric(14,2)`, nulo sem afiliado), com índice em `purchases.affiliate_code`. Tabelas já têm RLS forçada; coluna nova não exige `secure_table`, mas rodar `bun run test:rls`.
- `track/src/lib/sales/simintpay.ts`: o schema do evento passa a aceitar `affiliate: { code, commissionCents, name? }`. **A fonte de verdade é o `affiliate` do evento da SimIntPay** (ela decide quem recebe e quanto); `tracking.aff` só serve de reserva para a venda sem esse campo e nunca define comissão.
- Regra existente preservada: depois de aprovada, o afiliado e a comissão da venda ficam fixos. Reembolso, estorno e chargeback só mudam status e data; só uma nova aprovação do mesmo pedido pode atualizar esses campos. Comissão revertida fica visível no detalhe da venda, mas não reescreve a receita.
- Venda de visitante que não aceitou os cookies continua guardada e contada, agora com afiliado, vindo do evento da SimIntPay (que não depende do consentimento, porque o cookie `_trck_aff` é necessário). O afiliado aparece no painel como "Sem consentimento" apenas na parte de marketing; a comissão não é afetada.
- Retenção: o código do afiliado não é dado pessoal e permanece depois das limpezas, como UTMs e valor. Atualizar `RETENTION_DAYS`/docs só se algo mudar.

### Painel

- **Filtro "Afiliado"** (`SelectFilter` em `components/dashboard/filters.tsx`, estado na URL como `?afiliado=CODE`; vários valores como `?tipo=`; opções "Todos", "Sem afiliado" e cada código com nome quando houver). Vale em Faturamento, Visão geral, Páginas e Vídeos; em Campanhas não se aplica (é por anúncio da Meta, e o gasto não se divide por afiliado).
- **Faturamento**: coluna "Afiliado" em `purchases-table.tsx`, com filtro por código, e card "Por afiliado" (vendas, receita, comissão e líquido por código, ordenado por receita), seguindo a regra de renovações: receita conta tudo, números de aquisição só vendas novas.
- **Visão geral**: Receita, Compras, Conversão e funil respondem ao filtro; ROAS geral continua receita de vendas novas ÷ gasto, e o gasto não é filtrado (aviso no card quando há filtro de afiliado). Origens dos visitantes ganha o grupo "Afiliado · CODE" quando o visitante veio de afiliado.
- **Jornada do visitante**: mostra "Afiliado" em origem e atribuição (primeiro e último toque) e em cada compra.
- **Query**: um único helper `affiliateFilter(sp)` em `lib/dashboard/context.ts` aplicado em `revenue.ts`, `overview.ts` e `pages.ts`, para a regra ficar em um lugar só.
- Regra de negócio nova em `docs/business-rules.md` (Panel analytics) e `track/docs`.

## VSL

- **Nenhuma mudança de código no VSL.** Com `aff` como cookie necessário, o `t.js` carregado na VSL grava `_trck_aff` em `.rastrewin.com` ao abrir `vsl.rastrewin.com/?aff=CODE`, mesmo sem aceite, e o botão continua com link limpo para `rastrewin.com`, onde o frontend lê o cookie. Isso dispensa o repasse de `aff` na URL do botão que eu tinha proposto antes.
- Atualizar `vsl/AGENTS.md`: a frase "só depois do aceite, registra..." ganha a exceção do cookie `_trck_aff`; e o rodapé já aponta para a política de privacidade, que passa a listar o cookie.
- Conferir no navegador (`ui-screenshot-validation` não se aplica, não há mudança visual): abrir a VSL com `?aff=TESTE`, recusar o banner e ver que `_trck_aff` existe e que o link chega em `rastrewin.com` com o cookie.

## Ordem e commits

1. SimIntPay: migração e modelo (`feat(backend)`).
2. SimIntPay: endpoints, snapshot e liquidação, com testes de integração no PostgreSQL local (`feat(backend)`).
3. SimIntPay: tela de plataformas e ofertas, e checkout (`feat(frontend)`, `feat(checkout)`).
4. Rastrewin: captura, repasse e relay (`feat(track)`, `feat(frontend)`, `feat(backend)`).
5. Track: migração, venda com afiliado e comissão (`feat(track)`).
6. Track: filtro, coluna, card "Por afiliado" e jornada (`feat(track)`).
7. Docs do VSL, política de privacidade e versão do banner (`docs`, `feat(frontend)`).
8. Docs gerais (`docs`).

Nada vai para produção daqui: a SimIntPay aplica a migração e publica na ordem de `docs/coproduction.md` › Publicação.

## Progresso

- [ ] Decisões da tabela confirmadas
- [ ] SimIntPay: modelo
- [ ] SimIntPay: backend
- [ ] SimIntPay: frontend e checkout
- [ ] Rastrewin: captura e repasse
- [ ] Track: migração e venda com afiliado
- [ ] Track: filtro, coluna e card por afiliado
- [ ] Privacidade: cookie `_trck_aff`, política e versão do banner (validar com o jurídico)
- [ ] VSL: só documentação
- [ ] Docs
