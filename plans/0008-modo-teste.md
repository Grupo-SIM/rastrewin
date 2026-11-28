# Plano — Modo teste no track

## Contexto

Os testes da equipe nos sites (rastrewin.com e vsl.rastrewin.com) viram visitantes comuns: vão para a Meta e o GA4 (com `fbclid` inventado, como `fb.1.….teste`), entram nos números do painel e carregam UTMs antigas de teste por 90 dias. Em 28/11/2026 o visitante de teste do dono tinha 99 eventos desde 05/11 com a origem "instagram · campanha02".

O mockup aprovado em 28/11/2026 (scratchpad `modo-teste-mockup.html`) é a referência visual.

## Decisões

| Tema                | Decisão                                                                                                                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ligar               | Abrir uma vez `?rw_teste=1` em qualquer um dos sites. O `t.js` grava o cookie `_trck_teste` no domínio raiz (365 dias), então vale nos dois sites. `?rw_teste=0` ou "Sair" desliga.                                                                                  |
| Aviso no site       | Faixa roxa fixa no rodapé, "Modo teste · nada vai para Meta/GA4 · Sair", só no navegador em modo teste.                                                                                                                                                              |
| Navegador           | Em modo teste, o Pixel da Meta e a gtag não carregam e nenhum `fbq`/`gtag` é chamado.                                                                                                                                                                                |
| Consentimento       | Igual ao normal: sem aceite no banner, nada é gravado.                                                                                                                                                                                                               |
| Sair                | Apaga a marca e os identificadores de marketing (como a revogação, sem registrar recusa) e recarrega: a próxima visita é um visitante novo e comum.                                                                                                                  |
| Servidor            | `identify`/`event` com `test: true` marcam o visitante (`visitors.is_test`, `test_marked_at`). O tracker nunca desmarca. Eventos de visitante de teste não vão à CAPI (`response_meta = {"test": true}`, status "Teste (não enviado)").                              |
| Compras (decisão A) | Compra ou Pix gerado de visitante de teste: sem Purchase/AddPaymentInfo à Meta e sem GA4; aparece no Faturamento com selo "Teste", fora dos totais.                                                                                                                  |
| Jornada (decisão B) | Administrador marca ou desmarca o visitante como teste. Vale para o histórico inteiro nos relatórios; o que já foi enviado à Meta não volta.                                                                                                                         |
| Relatórios          | Visão geral, Campanhas, Páginas, Vídeos, Geo e Faturamento ignoram visitantes de teste (eventos, plays e compras ligados a eles) e mostram a nota "N visitante(s) de teste ficaram fora destes números". Eventos mostra tudo, com o selo e a chave "Mostrar testes". |
| Privacidade         | Não muda o que é coletado de visitantes comuns: sem nova versão da política nem do banner.                                                                                                                                                                           |

## Banco

Migração `0015`: `visitors.is_test boolean not null default false`, `visitors.test_marked_at timestamptz`, índice parcial em `trck_user_id` onde `is_test`, e `secure_table('public.visitors', true)` de novo (GRANT das colunas novas para o `app_reader`). `scripts/security-check.sql` passa a esperar 16 migrações.

## Etapas

1. [x] Banco: schema, migração 0015, security-check.
2. [x] Rastreador: `?rw_teste`, cookie, faixa, sem Pixel/gtag, `test: true` nos envios, "Sair".
3. [ ] Servidor: schemas, upsert do visitante, CAPI, AddPaymentInfo, Purchase/GA4, reenvio.
4. [ ] Painel: Eventos (selo, filtro, chave), relatórios sem testes + nota, Faturamento, Jornada (marcar/desmarcar).
5. [ ] Documentação (AGENTS do track, business-rules) e testes unitários.
6. [ ] Validação com screenshots num banco local descartável.

## Pendências de validação

- Desenvolvedores validam em produção depois do deploy.
