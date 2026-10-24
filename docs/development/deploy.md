# Deploy (Komodo + caddy-docker-proxy)

A imagem contém apenas o servidor Next.js standalone, sem Caddy interno. O `Dockerfile`
na raiz instala dependências, roda testes e compila o frontend. O workflow
`.github/workflows/publish-image.yml` publica a imagem no GHCR para amd64 e arm64.

## Configuração

1. Aponte o DNS de `vsl.rastrewin.com` para a VM.
2. Use um caddy-docker-proxy central com acesso ao Docker e à rede externa `caddy`.
   Se a rede tiver outro nome, defina `CADDY_NETWORK` no Komodo.
3. Configure no Komodo acesso ao GHCR com uma conta que tenha `read:packages`.
4. Crie a Stack usando `compose.yml` da raiz e selecione essa conta de registry.

Os labels configuram HTTPS automático, compressão, headers e proxy para a porta 3000.
O container não publica portas. Não é necessário editar um Caddyfile nem subir outro proxy.
Apenas portas 80 e 443 do proxy precisam estar abertas na VM.

## Atualização e rollback

Após publicar uma imagem, faça Redeploy da Stack no Komodo. `VSL_IMAGE_TAG` usa `latest`
por padrão; para rollback, use `sha-<7 primeiros caracteres do commit>`.
Variáveis disponíveis ficam em `.env.example`.

Next.js gerencia cache dos assets e das páginas. A CSP básica fica nos labels;
a geração de CSP completa com hashes do export estático e `CSP_MODE` foram removidos do deploy.

Referências: [Next.js standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
e [caddy-docker-proxy](https://github.com/lucaslorentz/caddy-docker-proxy).
