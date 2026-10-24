# Performance e segurança

## Performance

- **Estático:** HTML pré-renderizado no build (título, subtítulo, capa e logo aparecem sem esperar JS).
- **Vídeo sob demanda:** só a capa (uma imagem) carrega na abertura. A API e o iframe do YouTube só
  carregam no toque (economiza ~1MB e várias conexões). Ao passar o dedo/mouse na capa, já abrimos
  conexão com o YouTube (`preconnect`).
- **Fontes:** `next/font` serve Plus Jakarta Sans e Manrope do próprio domínio, só com os pesos usados.
- **Cache:** `/_next/static/*` imutável por 1 ano; HTML sempre revalida; imagens com 1h.
- **Compressão:** zstd/gzip no Caddy (HTML de ~14KB vira ~4KB).
- **JS:** ~144KB gzip (React + roteador do Next, o piso do App Router), todo `async` (não bloqueia a pintura).

### Medição (Lighthouse 13, mobile, Caddy local, capa provisória)

| Categoria      | Nota                         |
| -------------- | ---------------------------- |
| Performance    | 96                           |
| Acessibilidade | 100                          |
| Boas práticas  | 100                          |
| SEO            | 63, de propósito (`noindex`) |

FCP 0,8s · LCP 2,8s (a capa) · TBT 0ms · CLS 0.
O LCP melhora com a capa definitiva otimizada: **AVIF ou WebP, 720×1280, ~20–30KB**.

## Segurança

| Risco              | Mitigação                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| XSS                | Sem `dangerouslySetInnerHTML` (regra do Biome como erro); textos vêm do config e o React escapa. CSP com hashes. |
| Open redirect      | Destino do botão validado com Zod: só `https://rastrewin.com`, sem porta nem credenciais.                        |
| Clickjacking       | `X-Frame-Options: DENY` + `frame-ancestors 'none'`.                                                              |
| Terceiros          | Nenhum script de terceiros antes do toque; YouTube via `youtube-nocookie.com`.                                   |
| Privacidade (LGPD) | Sem cookies próprios, sem coleta de dados. Só o `localStorage` guarda "botão liberado".                          |
| Supply chain       | Poucas dependências, versões fixas, lockfile, `minimumReleaseAge` do pnpm, `pnpm audit`.                         |
| Container          | Sem root, read-only, `cap_drop: ALL`, `no-new-privileges`, sem portas publicadas.                                |
| Indexação          | `noindex` (meta + `X-Robots-Tag`). Sem bloqueio no robots.txt, para o noindex ser lido.                          |

### Por que o botão libera se o vídeo falhar?

O delay é um recurso de persuasão, não de segurança. Se o YouTube falhar (vídeo removido, rede),
travar o botão só perderia a venda. Nesse caso ele libera **só naquela visita** (não fica gravado).
