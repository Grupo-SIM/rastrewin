# Deploy (VM + Komodo + Caddy central)

## Como funciona

```
push na main ──▶ GitHub Actions ──▶ ghcr.io/grupo-sim/vslrastrewin ──▶ Komodo (VM) baixa e roda

Internet ──443──▶ Caddy central (HTTPS, HSTS) ──rede Docker──▶ container vsl-rastrewin (Caddy :8080, estático)
```

- **A imagem é feita no GitHub**, não na VM: o workflow `.github/workflows/publish-image.yml` roda a cada
  push na `main` (ou manualmente em Actions → **Publicar imagem** → **Run workflow**) e publica no GHCR
  para `linux/amd64` e `linux/arm64`, com as tags `latest` e `sha-<commit>`.
- O `deploy/Dockerfile` roda os testes antes do build (teste quebrado não publica imagem). O site é gerado
  uma vez só, na plataforma nativa, e só a etapa final (Caddy) é montada para cada processador.
- O container **não publica portas**. Só o Caddy central, na mesma rede Docker, alcança `vsl-rastrewin:8080`.
- O container roda **sem root** (uid 10001), com filesystem somente leitura, `cap_drop: ALL`,
  `no-new-privileges` e limites de memória, CPU e processos.
- Logs com rotação: até 3 arquivos de 10MB (30MB no máximo), para não encher o disco da VM.

## Primeira vez

1. **DNS:** crie o registro `A` (e `AAAA`, se houver IPv6) de `vsl.rastrewin.com` apontando para a VM.
2. **Rede Docker:** confirme o nome da rede do Caddy central (`docker network ls`). Se não for `caddy`,
   defina `CADDY_NETWORK` no Environment do Komodo.
3. **Acesso do Komodo ao GHCR** (o pacote é privado, como o repositório):
   - No GitHub, crie um **token clássico** em https://github.com/settings/tokens/new com **só** o escopo
     `read:packages` e uma validade (ex.: 1 ano; anote para renovar). O GHCR não aceita token fine-grained.
   - No Komodo, cadastre uma conta de registry (Docker Registry Account) para `ghcr.io` com o seu usuário
     do GitHub e esse token. Ele fica guardado no Komodo, nunca no repositório.
4. **Komodo:** crie uma Stack com o conteúdo de `deploy/compose.yaml` (colado na interface do Komodo:
   assim a VM não precisa de acesso ao código) e selecione a conta do GHCR do passo 3.
   Variáveis (nenhuma é segredo), conforme `.env.example`:
   - `CADDY_NETWORK` (padrão `caddy`)
   - `CSP_MODE` (padrão `report-only`)
   - `VSL_IMAGE_TAG` (padrão `latest`)
5. **Caddy central:** cole o conteúdo de `deploy/caddy-central.snippet` no Caddyfile central e recarregue.
   O certificado HTTPS é emitido automaticamente.
6. **Firewall da VM:** só 80 e 443 abertos para a internet.

## Atualizar o conteúdo

1. Edite `frontend/src/config/page-config.ts` (vídeo, segundos, textos) e/ou troque `frontend/public/poster.*`.
2. Rode `bun run test && bun run build` localmente (valor inválido quebra o build com a mensagem do Zod).
3. Commit, revise e faça push na `main`. Acompanhe em **Actions → Publicar imagem** (~3–5 min).
4. Com a execução verde, faça **Redeploy** da Stack no Komodo (ele baixa a `latest` nova).
   Opcional: ligue o **Auto Update** da Stack para o Komodo fazer isso sozinho quando a imagem mudar.

**Voltar a uma versão anterior:** defina `VSL_IMAGE_TAG=sha-<7 primeiros caracteres do commit>`
(lista em GitHub → Packages → vslrastrewin) e faça Redeploy. Para voltar ao normal, `latest`.

O HTML tem `Cache-Control: no-cache`, então a mudança aparece na hora. Imagens sem hash no nome
(capa, logo) ficam até 1h em cache; para efeito imediato, troque o nome do arquivo (ex.: `poster-v2.avif`).

## CSP (Content-Security-Policy)

- No build, `scripts/csp-hashes.mjs` calcula os hashes sha256 dos scripts inline do Next e gera as duas
  versões: `/etc/caddy/csp-report-only.caddy` e `/etc/caddy/csp-enforce.caddy`. Assim não precisamos de
  `'unsafe-inline'` em scripts.
- O `CSP_MODE` do container escolhe qual o Caddyfile importa. Valor diferente de `report-only`/`enforce`
  impede o container de subir (o erro aparece no log do Komodo).
- Começa em **Report-Only**. Depois de alguns dias sem avisos de CSP no console do navegador
  (DevTools → Console, procure por "Content Security Policy"), mude `CSP_MODE=enforce` no Komodo e faça
  Redeploy. Não precisa de build novo.
- Sempre aplicadas, independentemente do modo: `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'none'`.

## Conferir depois do deploy

```sh
curl -sI https://vsl.rastrewin.com | grep -iE "strict-transport|content-security|x-frame|x-robots|permissions"
```

Esperado: HSTS, CSP (+ Report-Only), `X-Frame-Options: DENY`, `X-Robots-Tag: noindex, nofollow` e sem header `Server`.

## Melhorias opcionais

- Fixar as imagens base por digest (`node:24.22.1-alpine3.24@sha256:…`, `caddy:2.11.7-alpine@sha256:…`)
  para builds 100% reprodutíveis.
- Se o build no GitHub falhar ao baixar as fontes do Google (instabilidade), rodar o workflow de novo;
  se persistir, trocar `next/font/google` por `next/font/local` com os arquivos `.woff2` commitados.
- Dependabot para manter as ações do workflow e as imagens base atualizadas.
