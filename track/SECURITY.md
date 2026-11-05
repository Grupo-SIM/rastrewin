# Segurança — Rastrewin

Resumo do modelo de segurança, do que foi auditado na Fase 8 (novembro de 2026) e do que precisa valer em produção.
As regras para quem mexe no código estão no [CLAUDE.md](CLAUDE.md), seção "Segurança".

## O que protegemos

- **Credenciais de terceiros:** tokens da Meta (CAPI e Ads), `api_secret` do GA4 e o segredo do webhook. Quem tiver esses dados envia eventos ou lê dados das contas de anúncio.
- **Dados de compradores e visitantes:** e-mail, telefone (com hash para a Meta), IP, geolocalização e histórico de compras.
- **Integridade das vendas:** uma venda forjada distorce o ROAS e ainda seria enviada à Meta e ao GA4.
- **Acesso ao painel.**

## Quem pode atacar e como barramos

| Ameaça                                     | Defesa                                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visitante ou robô forjando eventos         | Origem autorizada (CORS), rate limit por IP, limite de corpo, validação Zod. O IP, o user agent e a geo vêm do servidor. `Purchase` só entra pelo webhook.                                                                                                                                   |
| Venda forjada no webhook                   | HMAC-SHA256 do corpo bruto (`x-simintpay-signature`), comparado em tempo constante. Assinatura inválida → 401 e nada é gravado. As vendas chegam pelo backend do rastrewin, que valida a assinatura do SimIntPay e repassa assinando com o segredo do track.                                 |
| Reenvio (replay) de uma venda verdadeira   | Idempotência por `eventId` e por `transaction_id`. O status só avança (um evento antigo não desfaz reembolso).                                                                                                                                                                               |
| Força bruta no login                       | 5 tentativas por minuto por IP. Cadastro público desligado: usuários só entram via `create-admin`.                                                                                                                                                                                           |
| IP forjado para escapar dos limites        | O app só confia no `X-Real-IP` que o **nosso** proxy sobrescreve (ou no último IP do `X-Forwarded-For`). `cf-connecting-ip` e o 1º IP do XFF são ignorados. A porta 3000 fica presa em `127.0.0.1`.                                                                                          |
| CSRF / clickjacking                        | Better Auth confere a origem (`trustedOrigins`). Server Actions validam a origem. `frame-ancestors 'none'` + `X-Frame-Options: DENY`. Cookie `HttpOnly`, `Secure` (https) e `SameSite=Lax`.                                                                                                  |
| Leitura indevida no banco (bug ou injeção) | O app conecta como `app_login`, sem privilégio próprio. Escrita como `app_service`; leitura do painel como `app_reader`, com **RLS forçada em todas as tabelas**. O leitor só vê linhas se houver sessão válida no próprio banco e nunca lê colunas `*_enc` nem tabelas de login.            |
| Vazamento de segredo                       | Segredos cifrados com pgcrypto (AES-256), com a chave só no env do servidor. O painel mostra só a pista (`••••abcd`). Nada usa `NEXT_PUBLIC_`. `.env` fora do git e da imagem Docker. Logs com redação dos segredos do env. Erros de query registrados sem parâmetros (`src/lib/errors.ts`). |
| XSS                                        | React escapa tudo; não há `dangerouslySetInnerHTML` nem `eval`. CSP restringe a origem de scripts, estilos, imagens e conexões a `'self'`.                                                                                                                                                   |

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
- `test:retention` com 17 verificações.

## Riscos aceitos

- **CSP com `script-src 'unsafe-inline'`:** um nonce exigiria renderização dinâmica e é incompatível com Cache Components/PPR (guia do Next). Mitigação: sem HTML vindo do usuário, o React escapa tudo e as outras diretivas fecham o resto.
- **Webhook sem carimbo de tempo na assinatura:** o contrato do SimIntPay não envia um. Mitigação: idempotência e precedência de status. Um reenvio não muda nada.
- **Venda depende do repasse do backend:** se o track ficar fora do ar por mais que as 3 tentativas do backend (cerca de 12 s), o evento não chega. O SimIntPay reenvia ao backend só quando o próprio backend falha. Conciliar pelo histórico de eventos do SimIntPay (`SIMPAY_INBOUND_TOKEN`) fica como melhoria futura.
- **Rate limits em memória:** eles valem para **uma instância**. Com várias réplicas, cada uma conta separado, e um restart zera a contagem.
- **Eventos do site forjáveis por quem não é navegador:** o `Origin` é um controle de navegador. Isso vale para qualquer rastreamento no cliente. Mitigação: limites e validação. Vendas, que são o que importa para o ROAS, só entram pelo webhook assinado.
- **Dados pessoais guardados:** compras (e-mail) e o corpo bruto do webhook ficam sem prazo. A retenção diária só limpa os payloads do `events_log`. Revisar junto com o banner de cookies/LGPD.
- **Avisos do `bun audit`:** são do esbuild antigo dentro do `drizzle-kit` (servidor de desenvolvimento) e não há correção upstream. Esse pacote não vai para a imagem: o `.next/standalone` não o inclui.

## Checklist de produção

- [ ] O proxy (Caddy/nginx de `deploy/`) **sobrescreve** `X-Real-IP`, e o painel mostra "Proxy configurado" com o seu IP real.
- [ ] O app e o banco só escutam em `127.0.0.1`; o firewall libera só 22/80/443.
- [ ] `.env` com `chmod 600`. A `ENCRYPTION_KEY` também fica guardada fora da VPS.
- [ ] `APP_URL` em `https://` (cookie `Secure`).
- [ ] O código de teste da Meta está vazio e o modo debug do GA4 está desligado.
- [ ] Backup diário do banco funcionando, com uma restauração testada uma vez.
- [ ] A limpeza diária aparece como "Funcionando" em Configurações › Geral.
- [ ] O token do GHCR tem só `read:packages`, e a data de renovação está anotada.

## Comandos de verificação

```bash
bun run test:rls         # papéis, RLS, cifra
bun run test:retention   # limpeza diária (procedure + executor do app, com trava)
bun run test                 # unitários (inclui IP confiável e redação de logs)
bun audit --prod
```
