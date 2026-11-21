# Plano — AddPaymentInfo no cartão aprovado de primeira

## Contexto

O plano 0002 criou o `AddPaymentInfo` no Pix gerado (`pix_generated`) e no cartão recusado (`card_declined`). O SimIntPay gera os avisos pelo histórico de cada transação (a cada 30 s, um aviso por tipo e por transação) e não tem aviso de "cartão informado": o cartão aprovado de primeira só manda `purchase_approved` (`paymentMethod: CREDIT_CARD`). Esse caso ficava sem `AddPaymentInfo`, assim como o Pix cujo `pix_generated` chegasse depois da aprovação.

## Decisões (aprovadas em 16/11/2026)

- Todo pedido, Pix ou cartão, gera **um** `AddPaymentInfo`; o `Purchase` continua só na aprovação.
- Na aprovação, o `AddPaymentInfo` sai só se o pedido ainda não teve um, com horário 1 s antes da aprovação e antes do `Purchase`.
- Mesmas condições de hoje: aceite no banner, sem renovação, até 7 dias. Só Meta, uma tentativa.
- Só o track muda (sem migração). O `track/AGENTS.md` pode ser atualizado (autorizado pelo usuário).

## Etapas

1. **Regra** (`track/src/lib/sales/simintpay.ts`): `purchase_approved` entra em `ADD_PAYMENT_INFO_EVENTS`; na aprovação, a venda precisa estar ativa (aprovada ou em mediação); nos outros avisos, continua pendente/recusada.
2. **Envio** (`add-payment-info.ts` e webhook): `AddPaymentInfo` antes do `Purchase`; na aprovação, horário 1 s antes.
3. **Testes** do track e validação isolada: cartão aprovado de primeira; Pix normal; Pix fora de ordem; cartão recusado e depois aprovado; renovação no cartão; banner recusado; reentrega da aprovação.
4. **Documentação**: `docs/business-rules.md`, `track/AGENTS.md`.

## Progresso

- [x] 1 · [x] 2 · [x] 3 · [x] 4

Código completo em 16/11/2026. Deploy: só o track, sem migração.

## Validação isolada (16/11/2026)

Postgres descartável em Docker, track e backend locais, Meta falsa (nada saiu da máquina). Compradores criados pela API (visitante com aceite no track e cadastro no backend); avisos do SimIntPay assinados mandados ao backend, que repassa ao track.

| Cenário                                   | Meta recebeu                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| Cartão aprovado de primeira               | `AddPaymentInfo` (`addpaymentinfo_ORD-C1`, pro) 1 s antes do `Purchase`   |
| Reentrega da mesma aprovação              | nada                                                                      |
| Pix gerado → aprovado                     | `AddPaymentInfo` no Pix gerado; na aprovação, só `Purchase`               |
| Pix aprovado antes do aviso de gerado     | `AddPaymentInfo` 1 s antes do `Purchase`; o aviso atrasado não manda nada |
| Cartão recusado → aprovado (mesmo pedido) | `AddPaymentInfo` na recusa; na aprovação, só `Purchase`                   |
| Renovação no cartão                       | nada                                                                      |
| Banner recusado, cartão aprovado          | nada                                                                      |

Testes do track: 154.
