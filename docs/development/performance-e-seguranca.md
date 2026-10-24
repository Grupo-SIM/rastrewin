# Performance e segurança

## Performance

- **Estático:** HTML pré-renderizado no build (título, subtítulo, capa e logo aparecem sem esperar JS).
- **Player pré-carregado:** a página abre só com a capa (uma imagem). Depois que ela termina de abrir
  e o navegador fica ocioso, o player do YouTube (~1,2MB) carrega escondido atrás da capa, sem tocar.
  No toque, o vídeo começa quase na hora:

  | Rede (cache vazio)               | Clique → vídeo tocando        |
  | -------------------------------- | ----------------------------- |
  | Wi-Fi                            | ~0,5s (era ~1,7s)             |
  | 4G, clicando após ~10s de página | ~1,1s (era ~6,3s)             |
  | 4G, clicando após ~4s            | ~4,7s (player ainda baixando) |

  Sem pré-carregamento (carrega só no toque, ~1,7s no Wi-Fi): economia de dados ligada, rede 2G e
  quem já liberou o botão em visita anterior. Se o navegador bloquear o play (ex.: iPhone), em 2s a
  capa sai e aparece o play do próprio YouTube.
- **Fontes:** `next/font` serve Plus Jakarta Sans e Manrope do próprio domínio, só com os pesos usados.
- **Cache:** `/_next/static/*` imutável por 1 ano; HTML e `.txt` do Next sempre revalidam; imagens com 1h.
- **Compressão:** zstd/gzip no Caddy (HTML de ~14KB vira ~4KB).
- **JS:** ~144KB gzip (React + roteador do Next, o piso do App Router), todo `async` (não bloqueia a pintura).

### Medição (Lighthouse 13, mobile, Caddy local, capa provisória)

| Categoria      | Nota                                                                      |
| -------------- | ------------------------------------------------------------------------- |
| Performance    | 96                                                                        |
| Acessibilidade | 100                                                                       |
| Boas práticas  | 96 (aviso de cookie do iframe do YouTube, que agora carrega com a página) |
| SEO            | 63, de propósito (`noindex`)                                              |

FCP 0,8s · LCP 2,8s (a capa) · TBT 0ms · CLS 0.
O LCP melhora com a capa definitiva otimizada: **AVIF ou WebP, 720×1280, ~20–30KB**.

## Segurança

| Risco              | Mitigação                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XSS                | Sem `dangerouslySetInnerHTML` (regra do Biome como erro); textos vêm do config e o React escapa. CSP com hashes.                                                 |
| Open redirect      | Destino do botão validado com Zod: só `https://rastrewin.com`, sem porta nem credenciais.                                                                        |
| Clickjacking       | `X-Frame-Options: DENY` + `frame-ancestors 'none'`.                                                                                                              |
| Terceiros          | Só o YouTube (`youtube-nocookie.com`), pré-carregado depois de a página abrir. Nenhum outro script de terceiros.                                                 |
| Privacidade (LGPD) | Sem cookies próprios, sem coleta de dados. Só o `localStorage` guarda "botão liberado". O YouTube recebe a visita (pré-carregamento), mesmo de quem não dá play. |
| Supply chain       | Poucas dependências, versões fixas, lockfile, `minimumReleaseAge` do Bun, `bun audit`.                                                                           |
| Container          | Sem root, read-only, `cap_drop: ALL`, `no-new-privileges`, sem portas publicadas.                                                                                |
| Indexação          | `noindex` (meta + `X-Robots-Tag`). Sem bloqueio no robots.txt, para o noindex ser lido.                                                                          |

### Quando o botão é liberado

| Situação                                                                 | Libera? | Fica lembrado na próxima visita? |
| ------------------------------------------------------------------------ | ------- | -------------------------------- |
| Assistiu `unlockAtSeconds` segundos (só avanço normal; pulos não contam) | Sim     | Sim                              |
| Assistiu até o fim (vídeo mais curto que `unlockAtSeconds`)              | Sim     | Sim                              |
| YouTube deu erro (vídeo removido, bloqueado)                             | Sim     | Não                              |
| YouTube não carregou em 15s (rede travada, bloqueador)                   | Sim     | Não                              |

O delay é um recurso de persuasão, não de segurança. Travar o botão quando o vídeo falha só
perderia a venda.

### Acessibilidade do player

- Ao dar play pelo teclado, o foco acompanha o player (quadro → "Pausar vídeo"; em erro, o link do YouTube).
- O iframe do YouTube fica fora da ordem do Tab, para os links dele não tirarem a pessoa do funil.
  Pré-carregado atrás da capa, fica `inert` (fora do Tab e do leitor de tela) até o play.
- Durante o buffering aparece um spinner (e não o ícone de play).
