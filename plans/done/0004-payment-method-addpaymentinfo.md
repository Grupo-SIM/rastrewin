# 0004 · Meio de pagamento no AddPaymentInfo e públicos de Pix e cartão recusado

## Contexto

Na `6e36c87`, o `AddPaymentInfo` (servidor, webhook do SimIntPay) leva o mesmo `custom_data` do `Purchase` (`content_ids`, `contents`, `value`, `currency`, `order_id`), sem o meio de pagamento. O público **RW · Pix gerado sem compra 7d** (`120272647278170362`) inclui todo `AddPaymentInfo` dos últimos 7 dias, menos `Purchase` de 180 dias. Por isso ele junta quem gerou Pix e não pagou com quem teve o cartão recusado e não comprou. O cartão aprovado de primeira não entra, porque cai na exclusão de `Purchase`.

## Decisões

- `payment_method` no `custom_data` do `AddPaymentInfo`, a partir do meio que o SimIntPay informa no aviso (`purchases.payment_method`): `PIX` vira `pix` e `CREDIT_CARD` vira `credit_card`. Outro meio ou sem meio: o campo não é enviado.
- O `Purchase` fica como está (fora do escopo).
- Os públicos só mudam depois de o código estar no ar, porque os eventos antigos não têm o campo.

## Etapas

1. **Código (track):** `metaPaymentMethod` em `simintpay.ts`, usado pelo `deliverAddPaymentInfo` (`add-payment-info.ts`), mais um teste em `simintpay.test.ts`. A ordem na rota não muda: `AddPaymentInfo` com `.catch()` e depois `Purchase`, então uma falha no primeiro não impede o segundo.
2. **Docs:** `docs/business-rules.md`. `track/AGENTS.md` só com autorização.
3. **Validação isolada:** banco descartável e Meta falsa. Payload de Pix e de cartão, um único `AddPaymentInfo` por pedido (incluindo reentrega e recusa seguida de aprovação) e `Purchase` enviado mesmo com a Meta falhando no `AddPaymentInfo`.
4. **Revisão do usuário antes do push e do deploy.**
5. **Públicos na Meta, depois do deploy, com aprovação:**
    - **RW · Pix gerado sem compra 7d** (`120272647278170362`, editar a regra): inclusão `event = AddPaymentInfo` **e** `payment_method = pix`, 7 dias; exclusão `Purchase` 180 dias (já existe).
    - **RW · Cartão recusado sem compra 7d** (novo): inclusão `event = AddPaymentInfo` **e** `payment_method = credit_card`, 7 dias; exclusão `Purchase` 180 dias. O cartão aprovado de primeira também gera `AddPaymentInfo` com `credit_card`, mas cai na exclusão.
    - Os dois começam vazios e levam 7 dias para encher. Quem teve o cartão recusado e depois gerou Pix em outro pedido entra nos dois.

## Progresso

- [x] Etapa 1
- [x] Etapa 2
- [x] Etapa 3
- [x] Etapa 4
- [ ] Etapa 5 (parcial: público de Pix aplicado; cartão recusado aguarda decisão)

## Validação isolada (16/11/2026)

Postgres 18 descartável, track (`next dev`) com a Meta falsa, backend `node dist/main`. Avisos do SimIntPay assinados enviados ao backend, que repassa ao track.

| Cenário                                                        | Meta recebeu                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1. Pix gerado                                                  | `AddPaymentInfo` com `payment_method: pix`                               |
| 2. Mesmo Pix avisado de novo                                   | nada                                                                     |
| 3. Pix aprovado                                                | `Purchase`                                                               |
| 4. Cartão aprovado de primeira                                 | `AddPaymentInfo` com `credit_card`, depois `Purchase`                    |
| 5. Reentrega da mesma aprovação                                | nada                                                                     |
| 6. Cartão recusado                                             | `AddPaymentInfo` com `credit_card`                                       |
| 7. Mesmo pedido aprovado depois                                | `Purchase`                                                               |
| 8. Meta fora do ar só para o `AddPaymentInfo`, cartão aprovado | `AddPaymentInfo` falhou (registrado em `events_log`), `Purchase` enviado |
| 9. Meta de volta, reentrega da aprovação                       | nada (uma tentativa por pedido)                                          |

No banco: um único `addpaymentinfo_<pedido>` em `events_log` para cada um dos 4 pedidos, e `Purchase` enviado nos 4. O `Purchase` não leva `payment_method` (fora do escopo). Pendente: revisão do usuário antes do push e do deploy.

## Produção (16–17/11/2026)

- Push com autorização e deploy do track pelo usuário (`a332251`, CD às 01:08 UTC de 17/11).
- Confirmado no painel: `AddPaymentInfo` do pedido `446b0e8d…` (Pix de 16/11, 22:29) com `"payment_method": "pix"` e resposta da Meta `events_received: 1` (status 200). O mesmo no Pix de teste de 17/11, 13:00 (pedido `811fd514…`, checkout de assinatura), ligado ao visitante pelo `src` e sem `Purchase`.
- Público **RW · Pix gerado sem compra 7d** (`120272647278170362`): regra atualizada em 17/11/2026 com aprovação do usuário (`AddPaymentInfo` e `payment_method = pix`, 7 dias; menos `Purchase`, 180 dias) e lida de volta.
- **Pendente:** o público **RW · Cartão recusado sem compra 7d** (`payment_method = credit_card`) ficou para uma decisão separada do usuário.
