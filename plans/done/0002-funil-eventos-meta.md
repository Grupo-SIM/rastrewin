# Plano — Eventos do funil na Meta (itens 1 a 6 da auditoria de 16/11/2026)

## Contexto

A auditoria de 16/11/2026 (só leitura) mostrou o funil coberto de ponta a ponta, com Pixel + API de Conversões no mesmo `event_id` e consentimento respeitado. As lacunas eram de otimização: faltam eventos padrão entre o checkout e a compra, os eventos personalizados não viram públicos, o progresso da VSL não chega à Meta, o e-mail do topo da landing não identifica a pessoa e há três inconsistências pequenas. O GA4 fica como está (eventos novos só na Meta).

## Decisões (aprovadas em 16/11/2026)

- `ViewContent` só na seção de planos da landing (não no play da VSL).
- `AddPaymentInfo` em `pix_generated` **e** `card_declined`, uma vez por pedido.
- Política de privacidade continua na versão 1: só o texto fica mais preciso, sem dado ou finalidade nova.

## Etapas

1. **`AddPaymentInfo` pelo servidor (track).** No webhook, para `pix_generated` ou `card_declined`: venda ligada a visitante com aceite, sem recusa do banner, não renovação, pedido ainda não aprovado, aviso com menos de 7 dias. Grava em `events_log` com `event_id = addpaymentinfo_<pedido>` (idempotente, aparece em Eventos e na jornada) e envia à CAPI com os mesmos dados de correspondência do `Purchase`. Sem GA4, sem migração.
2. **Plano da venda nos `content_ids` (backend + track).** O backend repassa `plan` (do cadastro: `pendingPlan ?? plan`) com o evento; o track usa esse id no item principal do `Purchase`/`AddPaymentInfo` e no item do GA4. Sem o campo, comportamento atual.
3. **`ViewContent` (frontend).** Uma vez por visualização, quando a seção `planos` fica visível: `content_ids` basico/pro/vip, `content_type: product`, `content_name: Planos`, só Meta.
4. **E-mail do topo (frontend).** O envio do formulário do topo chama `trck('identify', { email })`. Política: seção 2 ("quando você informa seu e-mail no site ou se cadastra") e seção 4 ("eventos de navegação, de pagamento e de compra").
5. **Consistência (frontend).** `data-no-auto` no script do t.js do rastrewin.com (o botão "Renovar assinatura" deixa de gerar `InitiateCheckout`); `SectionView` também em `como_funciona`, `automatico`, `probabilidades` e `resultado_ao_vivo`.
6. **`VSLProgress` (vsl).** Marcos 25/50/75/95% pelo tempo realmente assistido, uma vez por carregamento; `percent`, `video_id`, `page_type: vsl`; só Meta.
7. **Documentação.** `docs/business-rules.md` (mapa de eventos), `docs/development/simintpay.md` (campo `plan`), `track/docs/lgpd.md`.
8. **Validação isolada.** Banco descartável e Meta falsa: Pix gerado → pago, Pix repetido, recusa, renovação, VSL com pulos, `ViewContent` uma vez, identify só com aceite, renovação sem `InitiateCheckout`.
9. **Públicos na Meta (depois de os itens acima estarem no ar, um por um com aprovação).** Compradores 180d; Pix gerado sem compra 7d; Checkout sem compra 14d; Cadastro sem compra 30d; VSL 75% sem cadastro 30d; Visitantes VSL 30d. Conversões personalizadas: dispensadas por ora (o connector não cria).

## Progresso

- [x] 1 · [x] 2 · [x] 3 · [x] 4 · [x] 5 · [x] 6 · [x] 7 · [x] 8 · [ ] 9

Código completo em 16/11/2026. **Pendente (não é código):** etapa 9, os públicos na Meta, criados um por um com aprovação do usuário, depois que backend, track, frontend e VSL estiverem no ar.

## Validação isolada (16/11/2026)

Postgres descartável em Docker, track, backend, landing e VSL locais; Meta/GA4 falsos (interceptação de fetch no track), Pixel, Vimeo (mesmo protocolo de postMessage, vídeo de 20 s) e checkout falsos no Playwright. Nada saiu da máquina.

- Landing com aceite: e-mail do topo identificado (`/api/identify` com e-mail; eventos seguintes levam o e-mail); `SectionView` nas 7 seções e `ViewContent` (basico/pro/vip) uma vez cada, mesmo rolando duas vezes; link de checkout decorado (src, UTMs, fbc, fbp) sem `InitiateCheckout` automático; cadastro → `CompleteRegistration` + `InitiateCheckout`. 18 eventos no Pixel, os 18 na CAPI com o mesmo `event_id`.
- Recusa: só `/api/config/public` e `/api/consent`; nenhum evento.
- VSL com pulo de 4 s em vídeo de 20 s: `VSLProgress` 25/50/75 (15 s realmente assistidos, sem o 95), `VSLCTAUnlock ended`.
- Webhook (SimIntPay assinado → backend → track): Pix gerado → `AddPaymentInfo` (`addpaymentinfo_ORDER-A`, content_ids pro); Pix repetido e Pix atrasado (pedido aprovado) → nada; aprovado → `Purchase` com content_ids pro; renovação (Pix e aprovação) → nada, `is_renewal`; recusa do banner → nada, "Banner recusado"; cartão recusado sem tracking no aviso (vale o do cadastro) → `AddPaymentInfo` vip, depois `Purchase` vip. `events_log` com o `AddPaymentInfo` e o GA4 marcado como não enviado.
- Testes: track 153, VSL 64. Telas da política (seções 2 e 4, data) conferidas em 1280 e 375 px.
