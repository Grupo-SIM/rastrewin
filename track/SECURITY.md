# Segurança — Rastrewin

Resumo do modelo de segurança, do que foi auditado na Fase 8 (novembro de 2026) e do que precisa valer em produção.
As regras para quem mexe no código estão no [CLAUDE.md](CLAUDE.md), seção "Segurança".

## O que protegemos

- **Credenciais de terceiros:** tokens da Meta (CAPI e Ads), `api_secret` do GA4 e o segredo do webhook. Quem tiver esses dados envia eventos ou lê dados das contas de anúncio.
- **Dados de compradores e visitantes:** e-mail, telefone (com hash para a Meta), IP, geolocalização e histórico de compras.
- **Integridade das vendas:** uma venda forjada distorce o ROAS e ainda seria enviada à Meta e ao GA4.
- **Acesso ao painel.**

## Quem pode atacar e como barramos

| Ameaça                                     | Defesa                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visitante ou robô forjando eventos         | Origem autorizada (CORS), rate limit por IP, limite de corpo, validação Zod (também em `/api/video`, o progresso de vídeo: 30/min por IP, 2 KB, cada envio só aumenta o progresso do próprio play). O IP, o user agent e a geo vêm do servidor. `Purchase` só entra pelo webhook. Visitas de robôs são ignoradas (`src/lib/tracking/bot-guard.ts`): redes da Meta (AS32934) e do Google (AS15169), servidores de nuvem e hospedagem (base DB-IP ASN Lite, lista em `src/lib/geo/bot-networks.ts`; Cloudflare, Akamai CDN e Fastly ficam de fora por causa do iCloud Private Relay), navegador que se declara robô, Chrome puro abaixo da versão 100 e navegador controlado por programa (`wd` do t.js). |
| Venda forjada no webhook                   | HMAC-SHA256 do corpo bruto (`x-simintpay-signature`), comparado em tempo constante. Assinatura inválida → 401 e nada é gravado. As vendas chegam pelo backend do rastrewin, que valida a assinatura do SimIntPay e repassa assinando com o segredo do track.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Sinal falso da fila de repasse             | `/api/webhook/relay-status` (aba Saúde) usa o mesmo segredo e a mesma assinatura das vendas e recusa sinais com mais de 10 min. O sinal só traz contagens e erros técnicos e só muda o que a aba Saúde mostra.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Pedido falso de acesso/exclusão de dados   | `/api/privacy/export` e `/api/privacy/erase` só aceitam o backend: mesma assinatura das vendas, corpo com a ação (o corpo de uma rota não serve na outra) e hora (mais de 5 min = recusado). O backend só chama depois que a pessoa confirmou pelo link enviado ao email dela (token de uso único, HMAC, 30 min); o telefone só vale se for o do cadastro desse email.                                                                                                                                                                                                                                                                                                                                  |
| Reenvio (replay) de uma venda verdadeira   | Idempotência por `eventId` e por `transaction_id`. O status só avança (um evento antigo não desfaz reembolso).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Força bruta no login                       | 5 tentativas por minuto por IP. Cadastro público desligado: usuários só entram via `create-admin`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IP forjado para escapar dos limites        | O app só confia no `X-Real-IP` que o **nosso** proxy sobrescreve (ou no último IP do `X-Forwarded-For`). `cf-connecting-ip` e o 1º IP do XFF são ignorados. O login (Better Auth) lê o `X-Real-IP` e só aceita um `X-Forwarded-For` de valor único; com vários valores, todos dividem um único limite (restritivo). A porta 3000 fica presa em `127.0.0.1`.                                                                                                                                                                                                                                                                                                                                             |
| CSRF / clickjacking                        | Better Auth confere a origem (`trustedOrigins`). Server Actions validam a origem. `frame-ancestors 'none'` + `X-Frame-Options: DENY`. Cookie `HttpOnly`, `Secure` (https) e `SameSite=Lax`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Leitura indevida no banco (bug ou injeção) | O app conecta como `app_login`, sem privilégio próprio. Escrita como `app_service`; leitura do painel como `app_reader`, com **RLS forçada em todas as tabelas**. O leitor só vê linhas se houver sessão válida no próprio banco e nunca lê colunas `*_enc` nem tabelas de login. Consultas com parâmetros (template `sql` do Drizzle); `sql.raw` só com nomes de coluna fixos no código.                                                                                                                                                                                                                                                                                                               |
| Vazamento de segredo                       | Segredos cifrados com pgcrypto (AES-256), com a chave só no env do servidor. O painel mostra só a pista (`••••abcd`). Nada usa `NEXT_PUBLIC_`. `.env` fora do git e da imagem Docker (`.dockerignore` exclui `**/.env*`, porque o Next copia o `.env` para o `.next/standalone`). Logs com redação dos segredos do env. Erros de query registrados sem parâmetros (`src/lib/errors.ts`).                                                                                                                                                                                                                                                                                                                |
| XSS                                        | React escapa tudo; não há `dangerouslySetInnerHTML` nem `eval`. CSP restringe a origem de scripts, estilos, imagens e conexões a `'self'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Auditoria da Fase 8 — achados e correções

1. **O IP podia ser forjado nos limites de tentativas**, porque o app aceitava `cf-connecting-ip`. Agora há uma regra única de IP confiável, e o login usa a mesma regra. Teste: 6ª tentativa de login → 429, mesmo trocando `cf-connecting-ip`/`x-forwarded-for` a cada tentativa.
2. **A porta 3000 estava aberta em todas as interfaces** no `docker-compose.yml`. Agora fica só em `127.0.0.1`.
3. **Não havia CSP.** Agora há uma CSP sem nonce (motivo abaixo), sem nenhum bloqueio nas 6 telas, nos dois temas, no celular e no desktop.
4. **A `ENCRYPTION_KEY` podia sair nos logs.** O Drizzle coloca os parâmetros da query na mensagem de erro, e a chave é um desses parâmetros. Duas correções: o processo agora apaga os segredos do env de tudo o que escreve no log, e os erros gravados no banco ou mostrados no painel só levam o código do Postgres.
5. **`/api/config/public` não tinha rate limit.** Agora tem (60/min por IP).
6. **CLI `shadcn` em `dependencies`.** Movido para `devDependencies`.

**Verificado sem achado:**

- histórico do git sem `.env` e sem tokens;
- os 4 segredos reais ausentes do git, do JS do navegador, do HTML do painel e dos logs;
- toda Server Action com sessão e Zod;
- `test:rls` com 30 verificações;
- `test:retention` com 30 verificações (inclui os prazos LGPD).

## Auditoria de novembro (2ª, 09/11/2026) — script de verificação

Revisão do que entrou depois da Fase 8 (vídeos, aba Saúde e repasse do backend, jornada do visitante, filtro de robôs, estrutura das campanhas, origem pelo referrer) e criação do `bun run security:check` (abaixo), que passa a conferir as regras sozinho.

**Achados e correções:**

1. **O `.env` podia entrar na imagem num build local.** O Next copia `.env` e `.env.production` para o `.next/standalone`, que o Dockerfile coloca na imagem, e o `.dockerignore` não os excluía. A imagem publicada não foi afetada: o CI constrói a partir do git, que não tem `.env`. Agora o `.dockerignore` da raiz exclui `**/.env*` (menos o `.env.example`), testado com um build de contexto.
2. **Dois logs de erro sem `safeErrorMessage`:** estrutura das campanhas e erro do pool do banco. Corrigido.
3. **O `test:rls` não pegava coluna sem permissão de leitura** (a classe do incidente da 0007, em que o painel deu 500). Agora confere coluna por coluna: o `app_reader` lê toda coluna não cifrada das tabelas do painel e nenhuma `*_enc` (32 verificações).

**Verificado sem achado:**

- as 11 Server Actions têm sessão (`requireSession` ou `readAsUser`) e validam a entrada com Zod;
- as 8 rotas de `/api` têm as proteções esperadas;
- a jornada valida o id do visitante e lê só via `readAsUser`; a busca de Eventos usa parâmetros;
- o login não aceita IP forjado (o Better Auth ignora `X-Forwarded-For` com vários valores);
- testes HTTP locais: cadastro recusado, webhook e relay-status sem assinatura → 401, corpo grande → 413, 6ª tentativa de login → 429 mesmo trocando `X-Forwarded-For` e `cf-connecting-ip`;
- `bun audit --prod` sem vulnerabilidades; o Next do track (16.4.4) está fora das faixas dos alertas;
- o `X-Powered-By` já estava desligado.

**Fora do track:** o `frontend` usa o Next 14.2.35, com alertas críticos que só têm correção a partir da 15.5.24. Fica para uma tarefa própria do frontend.

## Riscos aceitos

- **CSP com `script-src 'unsafe-inline'`:** um nonce exigiria renderização dinâmica e é incompatível com Cache Components/PPR (guia do Next). Mitigação: sem HTML vindo do usuário, o React escapa tudo e as outras diretivas fecham o resto.
- **Webhook sem carimbo de tempo na assinatura:** o contrato do SimIntPay não envia um. Mitigação: idempotência e precedência de status. Um reenvio não muda nada.
- **Venda depende do repasse do backend:** o backend guarda cada repasse na tabela `TrackRelay` e reenvia por até ~3 dias se o track estiver fora do ar. Depois disso, ou com erro definitivo (4xx que não seja 401/429), a linha fica com `lastError` e o evento não chega sozinho. A aba Configurações › Saúde mostra essas vendas (o backend manda um sinal por minuto) e o "Tentar de novo" as recoloca na fila. Os dados pessoais dessas linhas ficam no banco do backend até a entrega.
- **Rate limits em memória:** eles valem para **uma instância**. Com várias réplicas, cada uma conta separado, e um restart zera a contagem.
- **Eventos do site forjáveis por quem não é navegador:** o `Origin` é um controle de navegador. Isso vale para qualquer rastreamento no cliente. Mitigação: limites e validação. Vendas, que são o que importa para o ROAS, só entram pelo webhook assinado.
- **Dados pessoais guardados:** com prazo na limpeza diária (LGPD, `RETENTION_DAYS` em `src/lib/maintenance/retention.ts`): IP/navegador 90 dias, corpo bruto do webhook 90 dias, visitante sem atividade 13 meses, dados pessoais das vendas 5 anos (anonimizados), prova de consentimento 5 anos. Os plays de vídeo (`video_views`: id do visitante, progresso, UTMs e geo aproximada, sem e-mail) ficam sem prazo: depois que o visitante é apagado, o id aleatório não liga mais a ninguém. O `visitors.referrer` guarda só origem e caminho do site de onde a pessoa veio, sem query. Detalhes e o que personalizar: [docs/lgpd.md](docs/lgpd.md).
- **Avisos do `bun audit` (sem `--prod`):** vêm de ferramentas de desenvolvimento (esbuild antigo do `drizzle-kit`, dependências do CLI `shadcn`). Nenhuma vai para a imagem: o `.next/standalone` não as inclui, e o `bun audit --prod` sai limpo.

## Checklist de produção

Refaça a cada deploy com migration e uma vez por mês.

- [ ] `bun run security:check -- --url https://track.rastrewin.com` sem FALHA (só leitura).
- [ ] `scripts/security-check.sql` no banco de produção sem FALHA (só leitura; comando abaixo).
- [ ] O proxy **sobrescreve** `X-Real-IP` (no Komodo, label `caddy.reverse_proxy.header_up: "X-Real-IP {remote_host}"` — obrigatório, sem ele o limite de login pode ser burlado), e o painel mostra "Proxy configurado" com o seu IP real.
- [ ] Toda migration aplicada **inteira**, inclusive o `secure_table` (o SQL acima confere a quantidade e as colunas).
- [ ] O app e o banco só escutam em `127.0.0.1`; o firewall libera só 22/80/443.
- [ ] `.env` com `chmod 600`. A `ENCRYPTION_KEY` também fica guardada fora da VPS.
- [ ] `APP_URL` em `https://` (cookie `Secure`).
- [ ] O código de teste da Meta está vazio e o modo debug do GA4 está desligado.
- [ ] Configurações › Saúde recebe o sinal do backend (sem "aguardando sinal" por mais de alguns minutos).
- [ ] Backup diário do banco funcionando, com uma restauração testada uma vez.
- [ ] A limpeza diária aparece como "Funcionando" em Configurações › Geral.
- [ ] O token do GHCR tem só `read:packages`, e a data de renovação está anotada.

## Comandos de verificação

```bash
bun run security:check                         # regras no código (sem rede, sem banco)
bun run security:check -- --url https://track.rastrewin.com   # + de fora, só leitura (GET/HEAD/OPTIONS)
bun run security:check -- --url http://localhost:3000 --ativo  # + POSTs de teste (só aceita localhost)
bun run test:rls         # papéis, RLS, colunas do leitor, cifra (Postgres descartável)
bun run test:retention   # limpeza diária (procedure + executor do app, com trava)
bun run test             # unitários (inclui IP confiável e redação de logs)
bun audit --prod
```

Banco de produção (só leitura, como dono do banco; troque o container, o usuário e o banco pelos seus):

```bash
docker exec -i <container-do-postgres> psql -U <dono> -d <banco> < track/scripts/security-check.sql
```

Ao criar uma migration, atualize o número em `as esperado_migrations` no SQL; o `security:check` avisa se ele ficar diferente do `drizzle/meta/_journal.json`.
