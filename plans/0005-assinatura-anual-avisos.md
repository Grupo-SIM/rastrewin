# 0005 · Assinatura anual: aviso `subscription_activated` no backend

## Contexto

Em 17/11/2026, o SimIntPay passou a levar os links `?simLinkCode=` do Rastrewin para o checkout de oferta, que vende o plano como **assinatura anual** ("Assinar"; Pix pago a cada ciclo, cartão cobrado automaticamente). O usuário confirmou que esse é o modelo desejado.

Cada ciclo pago continua chegando como `purchase_approved` (pedido novo), que o backend já trata. Além dele, o SimIntPay manda `subscription_activated` no 1º ciclo pago e na reativação de um contrato suspenso. O backend respondia 400 a esse aviso, e o SimIntPay o reenviaria para sempre (até 1 vez por hora; a fila deles não trava).

## Decisões

- `subscription_activated` com assinatura válida: 200, sem efeito no cadastro e sem repasse ao track. Quem libera ou prorroga o plano continua sendo o `purchase_approved` do mesmo pagamento.
- Outros avisos desconhecidos continuam com 400, para um aviso novo (ex.: reembolso parcial) não ser descartado em silêncio.
- Fora do escopo, para decisão do usuário: aviso de renovação automática na landing e na política; botão "Renovar assinatura" do painel do cliente (abre um checkout novo e pode criar uma segunda assinatura; o SimIntPay tem a tela `?renovar`).

## Etapas

1. **Backend:** `ACKNOWLEDGED_ONLY_EVENTS`/`acknowledgedOnlyEvent` em `backend/src/payments/simintpay.ts`; a rota responde 200 antes da validação do evento de venda e registra só o nome do aviso.
2. **Docs:** `docs/development/simintpay.md` (assinatura anual e o aviso) e `docs/business-rules.md` (renovação anual).
3. **Validação isolada** (backend + track locais, Meta falsa, avisos assinados): `subscription_activated` sozinho; 1º ciclo de oferta (Pix gerado, aprovado, `subscription_activated`); reenvio do mesmo `purchase_approved`; renovação anual paga; reativação com `subscription_activated` e `purchase_approved` do mesmo ciclo, nas duas ordens. Conferir que cada pagamento libera ou prorroga uma vez só e que renovação não gera `Purchase`.
4. **Revisão do usuário antes do push.**

## Progresso

- [x] Etapa 1
- [x] Etapa 2
- [x] Etapa 3
- [ ] Etapa 4

## Validação isolada (17/11/2026)

Postgres 18 descartável, track com a Meta falsa e backend desta branch, com avisos assinados no formato do SimIntPay para venda de oferta (`offerId`, `chargeId`, itens `PRINCIPAL`) e para `subscription_activated`.

| Cenário                                                                                                   | Backend        | Repasse ao track         | Meta                   | Acesso                                     |
| --------------------------------------------------------------------------------------------------------- | -------------- | ------------------------ | ---------------------- | ------------------------------------------ |
| 1. Pix do 1º ciclo gerado                                                                                 | 200            | sim                      | `AddPaymentInfo` (pix) | pendente                                   |
| 2. 1º ciclo pago                                                                                          | 200            | sim                      | `Purchase`             | liberado por 1 ano, senha criada           |
| 3. `subscription_activated` do 1º ciclo                                                                   | 200 (ignorado) | não                      | nada                   | igual                                      |
| 4. Reenvio do mesmo `purchase_approved`                                                                   | 200            | não (já repassado)       | nada                   | igual                                      |
| 5. Mesmo pedido, `eventId` novo                                                                           | 200            | sim                      | nada                   | igual                                      |
| 6. Pix da renovação gerado                                                                                | 200            | sim                      | nada (renovação)       | igual                                      |
| 7. Renovação anual paga                                                                                   | 200            | sim                      | nada (renovação)       | +1 ano a partir do vencimento, mesma senha |
| 8. Reenvio da renovação                                                                                   | 200            | não                      | nada                   | igual                                      |
| 9–12. Reativação: `subscription_activated` e depois `purchase_approved` (vencido há 3 dias), mais reenvio | 200            | só o `purchase_approved` | nada                   | +1 ano a partir do pagamento, uma vez      |
| 13–15. Reativação: `purchase_approved` e depois `subscription_activated`                                  | 200            | só o `purchase_approved` | nada                   | +1 ano, uma vez                            |
| 16. `subscription_activated` de e-mail desconhecido                                                       | 200 (ignorado) | não                      | nada                   | —                                          |
| 17. Aviso desconhecido (`foo_bar`)                                                                        | 400            | não                      | nada                   | —                                          |

No track: os 3 primeiros ciclos com `Purchase` e um `AddPaymentInfo`; as 3 renovações (`is_renewal`) sem `Purchase` nem `AddPaymentInfo`; nenhum `subscription_activated` gravado. GA4 não configurado no ambiente isolado (não testado). A prorrogação é de 365 dias (comportamento anterior): num ano bissexto, cai um dia antes da data do ano seguinte.
