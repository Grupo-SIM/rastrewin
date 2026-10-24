# Deploy (VM + Komodo + Caddy central)

## Como funciona

```
Internet ──443──▶ Caddy central (HTTPS, HSTS) ──rede Docker──▶ container vsl-rastrewin (Caddy :8080, estático)
```

- O container **não publica portas**. Só o Caddy central, na mesma rede Docker, alcança `vsl-rastrewin:8080`.
- A imagem é construída em 2 etapas: Node gera `frontend/out/` (rodando os testes antes) e Caddy serve os arquivos.
- O container roda **sem root** (uid 10001), com filesystem somente leitura, `cap_drop: ALL`,
  `no-new-privileges` e limites de memória, CPU e processos.

## Primeira vez

1. **DNS:** crie o registro `A` (e `AAAA`, se houver IPv6) de `vsl.rastrewin.com` apontando para a VM.
2. **Rede Docker:** confirme o nome da rede do Caddy central (`docker network ls`). Se não for `caddy`,
   defina `CADDY_NETWORK` no Environment do Komodo.
3. **Komodo:** crie uma Stack apontando para este repositório, com o arquivo `deploy/compose.yaml`.
   Variáveis (nenhuma é segredo), conforme `.env.example`:
   - `CADDY_NETWORK` (padrão `caddy`)
   - `CSP_MODE` (padrão `report-only`)
4. **Caddy central:** cole o conteúdo de `deploy/caddy-central.snippet` no Caddyfile central e recarregue.
   O certificado HTTPS é emitido automaticamente.
5. **Firewall da VM:** só 80 e 443 abertos para a internet.

## Atualizar o conteúdo

1. Edite `frontend/src/config/page-config.ts` (vídeo, segundos, textos) e/ou troque `frontend/public/poster.*`.
2. Rode `bun run test && bun run build` localmente (valor inválido quebra o build com a mensagem do Zod).
3. Commit, revise e faça push. No Komodo, faça **Redeploy** da Stack (rebuild da imagem).

O HTML tem `Cache-Control: no-cache`, então a mudança aparece na hora. Imagens sem hash no nome
(capa, logo) ficam até 1h em cache; para efeito imediato, troque o nome do arquivo (ex.: `poster-v2.avif`).

## CSP (Content-Security-Policy)

- No build, `scripts/csp-hashes.mjs` calcula os hashes sha256 dos scripts inline do Next e gera
  `/etc/caddy/csp.caddy`, importado pelo Caddyfile. Assim não precisamos de `'unsafe-inline'` em scripts.
- Começa em **Report-Only**. Depois de alguns dias sem avisos de CSP no console do navegador
  (DevTools → Console, procure por "Content Security Policy"), mude `CSP_MODE=enforce` no Komodo e faça redeploy.
- Sempre aplicadas, independentemente do modo: `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'none'`.

## Conferir depois do deploy

```sh
curl -sI https://vsl.rastrewin.com | grep -iE "strict-transport|content-security|x-frame|x-robots|permissions"
```

Esperado: HSTS, CSP (+ Report-Only), `X-Frame-Options: DENY`, `X-Robots-Tag: noindex, nofollow` e sem header `Server`.

## Melhorias opcionais

- Fixar as imagens base por digest (`node:24.22.1-alpine3.24@sha256:…`, `caddy:2.11.7-alpine@sha256:…`)
  para builds 100% reprodutíveis.
- Se o build na VM falhar ao baixar as fontes do Google (rede instável), trocar `next/font/google` por
  `next/font/local` com os arquivos `.woff2` commitados.
