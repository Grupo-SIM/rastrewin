# Checklist de auditoria

Lista para conferir o projeto inteiro (`backend`, `frontend`, `track`, `vsl` e a infraestrutura). Refaça **a cada deploy que muda o banco** e **uma vez por mês**.

- **[auto]**: o script confere. Rode e veja a área citada.
- **[manual]**: precisa de alguém olhando o painel, o servidor ou uma conta externa.

## Como rodar o script

Na raiz do repositório:

```bash
bun scripts/audit/index.ts                            # código e repositório (rápido, sem rede)
bun scripts/audit/index.ts --producao                 # + os sites de fora, só leitura
bun scripts/audit/index.ts --ferramentas --producao   # + lint, tipos, testes, build e bun audit (demora)
```

Cada item sai como `✓ OK`, `! ATENÇÃO` ou `✗ FALHA`. Se houver alguma FALHA, o script termina com código 1. ATENÇÃO é para avaliar e não muda o código de saída.

O modo `--producao` só lê: faz GET/HEAD/OPTIONS, sem login, sem enviar evento e sem gravar nada. O script nunca toca em banco.

## 1. Repositório e CI

- [ ] **[auto]** Nenhum `.env`, chave ou certificado versionado, e nenhum token no histórico do git (área "Repositório e CI").
- [ ] **[auto]** Só `bun.lock`. A versão do Bun é a mesma no `package.json`, nos Dockerfiles e no CI.
- [ ] **[auto]** As actions do CI/CD estão fixadas por SHA e os workflows têm um bloco `permissions`.
- [ ] **[auto]** O `.gitignore` cobre todas as variações de `.env`.
- [ ] **[manual]** No GitHub (`Grupo-SIM/rastrewin`), a `main` está protegida (sem push direto e sem apagar), os Secrets/Variables têm só o necessário e o alerta de dependências (Dependabot) está ligado.
- [ ] **[manual]** O token do GHCR usado pelo Komodo tem só `read:packages`, e a data de renovação está anotada.

## 2. Variáveis de ambiente

- [ ] **[auto]** Cada projeto tem `.env.example` com toda variável obrigatória que o código lê, e nenhuma variável sem uso (área "Variáveis de ambiente").
- [ ] **[manual]** No Komodo, o backend tem `JWT_SECRET` com 32+ caracteres, `SIMPAY_WEBHOOK_SECRET`, `WHATSAPP_WEBHOOK_SECRET`, `TRACK_WEBHOOK_URL`/`TRACK_WEBHOOK_SECRET`, SMTP e os três `SIMPAY_CHECKOUT_URL_*`.
- [ ] **[manual]** Em produção **não** existem `ENABLE_TEST_TOOLS`, `NEXT_PUBLIC_ENABLE_TEST_TOOLS` nem `ADMIN_RESET_PASSWORD=true`. Esta última só vale para um reset pontual e deve ser removida depois.
- [ ] **[manual]** O `.env` no servidor tem `chmod 600`, e a `ENCRYPTION_KEY` do track está guardada fora da VPS.

## 3. Backend (api.rastrewin.com)

- [ ] **[auto]** Toda rota tem `AuthGuard`/`AdminGuard` ou é pública com limite próprio, e nenhuma decide de quem são os dados por um id na URL (área "Backend").
- [ ] **[auto]** Os DTOs têm tamanho máximo, o `ValidationPipe` recusa campo não declarado, e os cabeçalhos de segurança, o limite global e o CORS estão com uma origem só.
- [ ] **[auto]** Os webhooks comparam o segredo em tempo constante, e a ferramenta de teste fica desligada em produção.
- [ ] **[auto]** A imagem roda sem root e o `db push` não tem `--accept-data-loss`.
- [ ] **[auto]** De fora, sem token, as rotas do cliente e do admin respondem 401, o CORS não libera origem desconhecida, o 404 não vaza detalhes e a API não está atrás do proxy da Cloudflare (área "Produção (api.rastrewin.com)").
- [ ] **[manual]** O backend não tem migrations, porque usa `prisma db push` no boot. Antes de cada deploy que muda o `backend/prisma/schema.prisma`, confira que nenhuma coluna com dados vai ser removida ou renomeada: o `db push` sem `--accept-data-loss` falha nesse caso e a API não sobe.
- [ ] **[manual]** No admin do rastrewin.com, todo administrador tem 2FA ligado (botão "2FA").

## 4. Frontend (rastrewin.com) e VSL (vsl.rastrewin.com)

- [ ] **[auto]** A CSP e os cabeçalhos estão no código, sem HTML cru nem `eval`, sem `NEXT_PUBLIC_` com nome de segredo e com `noopener` nos links externos (áreas "Frontend" e "VSL").
- [ ] **[auto]** De fora, os cabeçalhos de segurança chegam de fato ao navegador em `rastrewin.com` e `vsl.rastrewin.com`, as páginas legais estão no ar e as duas páginas carregam o `t.js` do track.
- [ ] **[manual]** Com o navegador limpo (aba anônima), abra o rastrewin.com e a VSL **sem** aceitar o banner: em DevTools › Rede, nenhum pedido vai para `facebook.com`, `google-analytics.com` ou `googletagmanager.com`. Aceite o banner e confira que eles aparecem.

## 5. Track (track.rastrewin.com)

- [ ] **[auto]** O `security:check` do track passa sem FALHA. A auditoria o roda sozinha e, com `--producao`, inclui `--url https://track.rastrewin.com`.
- [ ] **[manual]** Siga o "Checklist de produção" de [`track/SECURITY.md`](../track/SECURITY.md): o `security-check.sql` no banco de produção (só leitura), o proxy sobrescrevendo `X-Real-IP`, as migrations inteiras, o backup, a limpeza diária e o código de teste da Meta vazio.

## 6. Infraestrutura (VPS e Komodo)

- [ ] **[auto]** Os compose versionados não publicam portas, rodam sem novos privilégios e sem capacidades, e o `.dockerignore` tira o `.env` das imagens (área "Infraestrutura").
- [ ] **[auto]** Os certificados TLS dos 4 domínios valem mais de 21 dias, e `http://` redireciona para `https://`.
- [ ] **[manual]** No Komodo, todos os stacks estão "Running", na imagem esperada (tag/commit) e sem reinícios em loop.
- [ ] **[manual]** O stack de cada serviço no Komodo é igual ao arquivo versionado (`compose.production.yaml`, `vsl/compose.yml`, `track/deploy/`). Em especial, as labels `caddy.header.*` da VSL: se o script acusa cabeçalhos faltando na VSL, é aqui que estão diferentes.
- [ ] **[manual]** O firewall da VPS libera só 22, 80 e 443, e o SSH entra só por chave.
- [ ] **[manual]** O backup diário dos bancos (backend e track) roda, e uma restauração foi testada.

## 7. Medição (Meta, GA4, SimIntPay)

- [ ] **[manual]** Meta › Gerenciador de Eventos: os eventos chegam (PageView, InitiateCheckout, CompleteRegistration, Purchase), a qualidade de correspondência (EMQ) está boa e a desduplicação está em "Atende às boas práticas".
- [ ] **[manual]** GA4 › Tempo real: os eventos chegam quando você navega com o banner aceito, e o modo debug está desligado no painel do track.
- [ ] **[manual]** No SimIntPay, o webhook aponta para `https://api.rastrewin.com/payments/webhook` com o mesmo segredo do `SIMPAY_WEBHOOK_SECRET`.
- [ ] **[manual]** Na aba Saúde do track, o sinal do backend está chegando.

## 8. LGPD

- [ ] **[auto]** A política de privacidade tem `POLICY_VERSION`, não tem marcas de rascunho (`PERSONALIZAR`) e cita toda chave que o site guarda no navegador (área "Frontend").
- [ ] **[manual]** A política foi revisada por um advogado, e o encarregado (ou o canal de contato) está definido.
- [ ] **[manual]** A "Versão do texto" do banner no painel do track é igual à `POLICY_VERSION` do `frontend/app/privacidade/page.tsx`.
- [ ] **[manual]** Um pedido de teste em `/privacidade/solicitacao` chega e é confirmado por e-mail.

## 9. E-mail

- [ ] **[auto]** O domínio rastrewin.com publica SPF e DMARC (área "Produção (DNS de rastrewin.com)"). Isso só importa se o e-mail sai por esse domínio.
- [ ] **[manual]** O domínio que realmente envia (o do `SMTP_FROM_EMAIL`) tem SPF, DKIM e DMARC. Um e-mail de "esqueci a senha" chega na caixa de entrada, não no spam.

## 10. Dependências e build

- [ ] **[auto]** Com `--ferramentas`: o lint, a formatação, os tipos, os testes e o build passam, e o `bun audit --prod` não tem aviso alto ou crítico (área "Ferramentas").
- [ ] **[manual]** Os avisos do `bun audit` que sobram (ferramentas de desenvolvimento) foram lidos, e nenhum vai para a imagem.
