# Plano — Usuários e níveis de acesso no painel do track

## Contexto

Hoje o painel do track (`track/`) não tem níveis: qualquer login enxerga e faz tudo, inclusive Configurações (tokens da Meta e do GA4, segredo do webhook, privacidade). Só existe um login, e só o dono o conhece. Uma pessoa já espera acesso ao painel, mas não pode receber o login do dono.

Este plano cria a aba **Usuários** com dois níveis fixos. O mockup aprovado (25/11/2026) é a referência visual.

## Decisões

| Tema                                 | Decisão                                                                                                                                                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Níveis                               | **Administrador** ("Acesso total") e **Colaborador** ("Acesso limitado"). Dois níveis fixos, sem permissões configuráveis.                                                                                                                |
| Administrador                        | Tudo, inclusive **Configurações** (com Saúde) e **Usuários**.                                                                                                                                                                             |
| Colaborador                          | Visão geral, Eventos, Faturamento, Campanhas, Páginas, Vídeos, Geo e jornada do visitante. Atualiza campanhas e abre detalhes de eventos e vendas. Não vê Configurações, Usuários, a faixa de saúde nem os links "Ir para Configurações". |
| Dados de clientes para o Colaborador | Mascarados **no servidor**: nome `M***** A****`, e-mail `m***@gmail.com`, telefone `(11) *****-**21`, IP `187.45.*.*`.                                                                                                                    |
| Dados brutos da venda (webhook)      | Só para o Administrador. O Colaborador vê "Disponível só para Administrador".                                                                                                                                                             |
| Payloads enviados à Meta/GA4         | Para o Colaborador, IP e identificadores com hash (em, ph, fn, ln, ct, st, zp, country, external_id, `ip_override`, `client_ip_address`) aparecem como "oculto". `fbc`, `fbp` e navegador ficam visíveis.                                 |
| Busca por e-mail em Faturamento      | Só para o Administrador (o Colaborador continua buscando por pedido e produto).                                                                                                                                                           |
| Senhas                               | O Administrador define a senha ao criar e ao redefinir (campo visível, **Copiar** e **Gerar senha forte**, mínimo 12). Sem senha temporária nem troca obrigatória. Trocar a própria senha pede a atual.                                   |
| Ações em massa                       | Tornar Administrador, Tornar Colaborador, Ativar, Desativar e Excluir (Tornar Administrador, Desativar e Excluir pedem confirmação).                                                                                                      |
| Registro de atividades               | Fica para depois.                                                                                                                                                                                                                         |
| E-mail de recuperação e 2FA          | Fora do escopo (não existem hoje).                                                                                                                                                                                                        |
| RLS por nível no banco               | Fora do escopo. A proteção desta entrega fica no código do servidor, coberta por testes.                                                                                                                                                  |

## Regras de segurança (servidor)

1. Toda checagem é feita no servidor, a cada pedido. Esconder UI nunca é a proteção.
2. `requireAdmin()` em `src/lib/dal.ts` na página `/painel/config` e nas 10 ações de `src/app/painel/config/actions.ts` (`saveAccount`, `deleteAccount`, `setAccountActive`, `testAccount`, `saveGeneral`, `savePrivacy`, `markErasureGaDone`, `generateWebhookSecret`, `setWebhookSecret`, `retryBackendRelays`), e em `/painel/usuarios` com todas as suas ações. Página: redireciona para `/painel`. Ação: "Sem permissão".
3. Mascaramento antes de o dado sair do servidor: `src/lib/dashboard/journey.ts`, `details.ts` e `revenue.ts`, com funções únicas em `src/lib/privacy/mask.ts`.
4. Plugin `admin` do Better Auth 1.7.15 só pela API do servidor: todas as rotas `/api/auth/admin/*` em `disabledPaths` (404) e personificação desligada. As travas ficam no nosso código.
5. Travas:
    - ninguém muda o próprio nível nem se desativa ou se exclui;
    - sempre ≥ 1 Administrador ativo, checado numa transação que trava as linhas dos administradores;
    - ação em massa com o próprio id é recusada inteira.
6. Sessões: desativar, excluir ou redefinir senha revoga todas as sessões da pessoa; o nível é lido do banco a cada pedido; conta desativada vê "Conta desativada. Fale com o administrador.".
7. Senhas com mínimo de 12 (regra atual), hash do Better Auth, rate limit de login atual; senha nunca em log.
8. Zod em toda entrada: e-mail em minúsculas e único; nível só `admin` ou `colaborador`.

## Banco

Migração `0014`, testada em `postgres:15` (produção) e `postgres:18`:

- `user`: `role` (`admin` | `colaborador`, com CHECK), `banned`, `ban_reason`, `ban_expires`. Usuários existentes viram `admin`; o padrão para novos é `colaborador`.
- `session`: `impersonated_by` (exigida pelo schema do plugin; sempre vazia).
- Sem mudança em papéis do servidor nem em tabelas de eventos e vendas. Excluir usuário apaga só `session` e `account` (cascade; nenhuma outra tabela aponta para `user`).
- `scripts/security-check.sql` passa a esperar 15 migrations.
- `scripts/create-admin.ts` cria o usuário como `admin` (caminho de recuperação).

## Etapas

Cada etapa vira commit local (`feat(track)` / `docs`), sem push. Ao fim de cada uma: resumo e espera de aprovação.

0. Worktree isolado e este plano.
1. Banco e login: migração 0014, schema, plugin configurado e fechado, `create-admin` como admin, auditoria com 15 migrations. `test:rls` e `test:retention` em Postgres 15 e 18.
2. Bloqueios: `requireAdmin()` na página e nas 10 ações de Configurações; menu filtrado por nível (sidebar e barra do celular); faixa de saúde e links "Ir para Configurações" escondidos para o Colaborador.
3. Mascaramento: `mask.ts` aplicado na jornada, no detalhe de evento, no detalhe de venda e na busca de Faturamento.
4. Aba Usuários: página, lista, formulários, ações individuais e em massa com travas, aba "Níveis e permissões", "Trocar minha senha".
5. Documentação: regra "toda tela nova com dado pessoal passa pela máscara", níveis e guia de recuperação (pt-BR, comandos prontos).

## Validação

- Testes unitários (suíte existente do track): funções de máscara (nome, e-mail, telefone, IPv4, IPv6, vazio) e um teste que falha se alguma ação de Configurações ou Usuários não chamar `requireAdmin()`.
- Ponta a ponta local (banco descartável, painel local, Chromium):
    - Colaborador: `/painel/config` e `/painel/usuarios` redirecionam; cada ação bloqueada chamada direto é recusada; `/api/auth/admin/*` = 404; nenhum nome, e-mail, telefone ou IP completo no HTML nem nas respostas; busca por e-mail sem resultado.
    - Administrador: tudo funciona; travas seguram (inclusive chamando o servidor direto); desativar e redefinir senha derrubam a sessão; sessão aberta antes da migração continua válida.
- Prints em 320, 390, 768 e 1280 px comparados com o mockup.
- Hook de commit: type-check, build e lint.
- Teste do usuário: painel local com dados fictícios, 1 Administrador e 1 Colaborador de teste.

## Produção (só com autorização explícita, depois da análise de 28/11)

1. Backup de `user`, `account` e `session`.
2. Migração 0014 no banco de produção (compatível com o código atual).
3. Conferência só de leitura: 1 usuário, `role = admin`.
4. Push (quando o usuário pedir) → CD gera as imagens.
5. Deploy do track pelo usuário no Komodo, fora do pico.
6. Verificação: login, aba Usuários, criação do Colaborador que espera acesso.

Volta atrás: reimplantar a imagem anterior no Komodo (as colunas novas não atrapalham o código antigo).

## Progresso

- [x] Decisões e mockup aprovados (25–26/11/2026)
- [x] Etapa 0: worktree `feat/track-usuarios-niveis` e este plano
- [x] Etapa 1: banco e login — migração 0014 testada em Postgres 15 e 18 (upgrade com usuário e sessão existentes: vira admin, sessão continua válida; `test:rls` 35/35, `test:retention` 30/30, auditoria com 15 migrations e checagem de administrador ativo); plugin admin com rotas `/api/auth/admin/*` em 404 (inclusive variações de grafia); conta desativada recebe "Conta desativada. Fale com o administrador."; `create-admin` cria administrador
- [x] Etapa 2: bloqueios de acesso — `requireAdmin`/`readAsAdmin`/`denyUnlessAdmin` em `dal.ts`; página e 10 actions de Configurações, Saúde e faixa só para Administrador; menu por nível (computador e celular); estados vazios mostram "Peça a um administrador para configurar."; teste `admin-guard.test.ts` (falha se uma action de admin perder a trava ou se surgir arquivo de actions não classificado). Ponta a ponta local: Colaborador redirecionado de `/painel/config`, `saveGeneral` repetida com a sessão dele = "Sem permissão" e banco intacto, troca de nível vale no próximo clique. Visto: aviso pré-existente do `pg` (consultas paralelas na mesma transação em `getHealthIssues`), fora do escopo
- [x] Etapa 3: mascaramento — `src/lib/privacy/mask.ts` (nome, e-mail, telefone, IPv4/IPv6 e `redactPersonal` para payloads, com testes) aplicado na jornada, nos detalhes de evento e venda (webhook bruto omitido, `webhookHidden`) e na busca de Faturamento (sem e-mail para o Colaborador). Card Gasto: texto pede ajuda ao administrador. Ponta a ponta: nenhum dado completo nas respostas de rede do Colaborador (controle acha nas do admin), busca por pedido mantida, celular sem rolagem lateral
- [x] Etapa 4: aba Usuários — `/painel/usuarios` (lista, filtros, busca, seleção e ações em massa, Adicionar com Copiar/Gerar senha forte, Editar, Redefinir senha, Desativar/Reativar, Excluir, Trocar minha senha, Níveis e permissões); gravações em transação com trava das linhas (`withLockedUsers` + `checkUserChange`, testado); login mostra "Conta desativada". `security:check` passa a aceitar `denyUnlessAdmin`/`requireAdmin` como trava (51 OK). Ponta a ponta: 57 verificações, incluindo actions chamadas direto pelo Colaborador, pelo admin contra si mesmo e corrida entre dois admins (sobra admin ativo). Visto (pré-existente, só em dev): aviso `Could not validate instant` ao redirecionar sessão derrubada
- [ ] Etapa 5: documentação
- [ ] Validação ponta a ponta e prints
- [ ] Teste do usuário (local)
- [ ] Produção (autorização pendente)
