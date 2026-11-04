# Go-live — colocar o Rastrewin no ar (VPS + Caddy ou nginx)

Endereço final: **https://track.rastrewin.com**. Os comandos foram feitos para Ubuntu 24.04, mas valem para qualquer Debian/Ubuntu recente.
Faça tudo na ordem. Cada bloco de código pode ser copiado e colado inteiro.

---

## 1. DNS
No painel do domínio `rastrewin.com`, crie um registro:

| Tipo | Nome | Valor |
|---|---|---|
| A | `track` | IP da VPS |

Para conferir, rode no seu Mac `dig +short track.rastrewin.com`. O resultado deve ser o IP da VPS.

## 2. Preparar a VPS
Entre na VPS (`ssh root@IP_DA_VPS`) e rode:

```bash
# Docker oficial
curl -fsSL https://get.docker.com | sh

# Firewall: só SSH, HTTP e HTTPS. O app e o banco escutam só em 127.0.0.1.
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

mkdir -p /opt/rastrewin/backups && cd /opt/rastrewin
```

## 3. Acesso às imagens (GHCR)
A imagem do app é privada (o banco usa o `postgres:18` oficial, público). No GitHub, vá em **Settings › Developer settings › Personal access tokens › Tokens (classic)**:
- crie um token só com **`read:packages`**;
- use uma validade longa e anote a data de renovação.

```bash
docker login ghcr.io -u SEU_USUARIO_GITHUB
# cole o token como senha
```

## 4. Arquivos
**No seu Mac**, na pasta do projeto, envie os arquivos de `deploy/` para a VPS:

```bash
scp deploy/docker-compose.yml deploy/Caddyfile root@IP_DA_VPS:/opt/rastrewin/
```

## 5. Segredos (`.env`)
**Na VPS**, gere todas as senhas e chaves de uma vez:

```bash
cd /opt/rastrewin
gen() { openssl rand -base64 48 | tr -d '/+=' | cut -c1-40; }
PG=$(gen); APP=$(gen)
cat > .env <<EOF
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$PG
DATABASE_URL=postgres://app_login:$APP@db:5432/rastrewin
MIGRATION_DATABASE_URL=postgres://postgres:$PG@db:5432/rastrewin
ENCRYPTION_KEY=$(gen)
BETTER_AUTH_SECRET=$(gen)
APP_URL=https://track.rastrewin.com
EOF
chmod 600 .env
cat .env
```

> **Guarde o `ENCRYPTION_KEY` num gerenciador de senhas, fora da VPS.** Os tokens da Meta e do GA4 ficam cifrados com essa chave. Se ela se perder, o backup do banco não abre esses segredos e será preciso cadastrá-los de novo.

## 6. Subir banco e app

```bash
cd /opt/rastrewin
docker compose pull
docker compose up -d db
docker compose --profile tools run --rm migrate
docker compose run --rm -it app node scripts/create-admin.mjs --email SEU_EMAIL --name "Seu Nome"
docker compose up -d app
curl -s http://127.0.0.1:3000/api/health      # deve responder {"ok":true}
```

O `create-admin` pede a senha sem mostrá-la na tela. Não existe cadastro público: novos usuários só entram por este comando.

## 7. HTTPS (escolha UM)

### Opção A — Caddy (recomendado: o HTTPS é automático)
```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
cp /opt/rastrewin/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
```

### Opção B — nginx + certbot
Envie também o `deploy/nginx.conf` (`scp deploy/nginx.conf root@IP_DA_VPS:/opt/rastrewin/`). Depois, na VPS:
```bash
apt install -y nginx certbot python3-certbot-nginx
cp /opt/rastrewin/nginx.conf /etc/nginx/sites-available/rastrewin
ln -s /etc/nginx/sites-available/rastrewin /etc/nginx/sites-enabled/rastrewin
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
certbot --nginx -d track.rastrewin.com --redirect
```

> As duas configurações **sobrescrevem** o cabeçalho `X-Real-IP` com o IP de quem conectou. O app só confia nesse cabeçalho para a geolocalização, para os limites de acesso e para o limite de tentativas de login. **Não troque** por `$proxy_add_x_forwarded_for`: esse valor mantém o que o navegador enviou, e aí o IP pode ser forjado.

Abra https://track.rastrewin.com e entre com o usuário criado.

## 8. Configurar pelo painel
O banco de produção é novo e o `ENCRYPTION_KEY` é outro. Por isso, **cadastre de novo** tudo o que você configurou no ambiente local.

1. **Configurações › Geral**
   - **Sites autorizados:** `https://rastrewin.com` e `https://www.rastrewin.com`, se usar o www.
   - **Domínios de checkout:** o domínio do checkout do SimIntPay.
   - **Código de teste da Meta:** deixe **vazio**. Com ele preenchido, os eventos vão só para "Testar eventos" e não contam nas campanhas.
   - **Modo debug do GA4:** **desligado**, depois do teste do passo 11.
   - **Fuso:** Brasília. É o mesmo da conta de anúncios.
2. **Configurações › GA4, Pixels Meta e Contas de anúncio**
   - Cadastre cada conta e clique em **Testar conexão** em todas.
3. **Configurações › Geral › Manutenção e servidor**
   - **Seu IP visto pelo servidor** deve ser o **seu** IP. Para conferir, abra https://ifconfig.me no seu computador e compare.
   - **Proxy reverso** deve mostrar **"Proxy configurado"**.

## 9. Script no site
Copie o código do cartão **Instalação no site** (Configurações › Geral) e cole no `<head>` de todas as páginas do rastrewin.com.

## 10. Webhook no SimIntPay
1. Em **Configurações › Geral › Webhook de vendas**, clique em **Gerar segredo**. Ele aparece **uma única vez**: copie.
2. Envie ao time do SimIntPay, **por um canal seguro** (gerenciador de senhas compartilhado; nunca por e-mail ou WhatsApp em texto puro):
   - `WEBHOOK_URL` = `https://track.rastrewin.com/api/webhook/compra`
   - `WEBHOOK_SECRET` = o segredo copiado. Deve ser **o mesmo** salvo no painel.
3. Confirme com eles que o patch de rastreamento do checkout está aplicado: o checkout deve repassar `src`, `utm_*`, `fbc` e `fbp`.

## 11. Teste ponta a ponta
1. Ligue **temporariamente** o modo debug do GA4 e preencha o código de teste da Meta. Ele fica em Gerenciador de Eventos › seu pixel › Testar eventos.
2. Abra o site numa aba anônima, clique no botão de compra e pague o **menor valor possível**.
3. Confira os quatro destinos:
   - no painel, **Eventos** mostra PageView e InitiateCheckout;
   - **Faturamento** mostra a venda "Aprovada", com Meta e GA4 "Enviado";
   - a Meta mostra o Purchase em **Testar eventos**;
   - o GA4 mostra o `purchase` no **DebugView**.
4. **Desligue o modo debug** e **apague o código de teste**.

## 12. Backup diário
Na VPS, rode `crontab -e` e acrescente a linha abaixo. Ela gera um backup às 04:15 e guarda os últimos 7 dias:
```cron
15 4 * * * cd /opt/rastrewin && docker compose exec -T db pg_dump -U postgres -Fc rastrewin > backups/rastrewin-$(date +\%F).dump && find backups -name '*.dump' -mtime +7 -delete
```
Copie os backups para fora da VPS de vez em quando, por exemplo com `scp` para o seu computador ou um bucket.
Para restaurar: `docker compose exec -T db pg_restore -U postgres -d rastrewin --clean < backups/ARQUIVO.dump`.

## Atualizar para uma versão nova
Cada push na `main` publica imagens novas.
```bash
cd /opt/rastrewin
docker compose pull
docker compose --profile tools run --rm migrate
docker compose up -d
docker image prune -f
```

## Problemas comuns
| Sintoma | Causa provável |
|---|---|
| "Proxy sem X-Real-IP" no painel | O proxy não está com a config de `deploy/`. Confira o `header_up X-Real-IP` no Caddy ou o `proxy_set_header X-Real-IP` no nginx. |
| O IP mostrado é o da VPS (ex.: 127.0.0.1) | O proxy está repassando o próprio IP. Use `{remote_host}` no Caddy ou `$remote_addr` no nginx. |
| Script do site não envia eventos | O site não está em "Sites autorizados" ou está sem `https://`. |
| Webhook não chega | Veja "Último evento recebido" no cartão do webhook. Se não aparecer nada, confira com o SimIntPay a URL **e** o segredo: envios com assinatura inválida são recusados (401) e não ficam registrados. Os logs mostram as recusas: `docker compose logs app \| grep webhook`. |
| Limpeza diária "Falhou" ou "Atrasada" | Ela roda dentro do app. Veja o erro com `docker compose logs app \| grep retenção`. Para rodar à mão: `docker compose exec db psql -U postgres -d rastrewin -c "CALL app_private.run_retention()"`. |
