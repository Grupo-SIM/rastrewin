# Performance e segurança

## Performance

- **Estático:** HTML pré-renderizado no build (título, subtítulo, capa e logo aparecem sem esperar JS).
- **Player pré-carregado, play do próprio Vimeo:** a página abre só com a capa (uma imagem). Depois que
  ela termina de abrir e o navegador fica ocioso, o player do Vimeo (~550KB) carrega embaixo da capa,
  sem tocar. A capa vira só imagem (`pointer-events: none`): o toque atravessa e cai no play do Vimeo,
  que fica no centro, embaixo do play colorido da capa. A capa some quando o Vimeo começa a tocar.
  A biblioteca `@vimeo/player` (~8KB comprimida) vem do próprio site, só nesse momento.

    Por que o play é o do Vimeo: o iPhone só libera o som quando o toque acontece dentro do documento
    do vídeo. Um play pedido pela página (mensagem para o iframe) saía mudo e pedia um 2º toque.

    O player do Vimeo mostra só o play (`progress_bar=0`, `skipping_forward=0`, sem volume, tela cheia,
    qualidade, legendas, logo), na cor `--ink`. Pausar e continuar é tocar no vídeo, pelo próprio Vimeo.

    Sem pré-carregamento (economia de dados ou 2G; só o Chrome informa isso, então o iPhone sempre
    pré-carrega): a capa tem o play do site, e o toque cria o player com `autoplay`. O toque na página
    libera o som no Chrome; se mesmo assim sair mudo, o Vimeo mostra o botão de som dele. Tocar na capa
    antes de o pré-carregamento terminar mostra o carregamento; pronto, o próximo toque já cai no Vimeo.

- **Fontes:** Plus Jakarta Sans e Manrope ficam em `src/app/fonts` (subconjunto latin, licença OFL) e o `next/font/local` as serve do próprio domínio. Nem o build nem o navegador acessam o Google Fonts.
- **Cache:** `/_next/static/*` imutável por 1 ano; HTML e `.txt` do Next sempre revalidam; imagens com 1h.
- **Compressão:** zstd/gzip no Caddy (HTML de ~16KB vira ~5KB).
- **JS:** ~172KB comprimido, medido no Lighthouse (React + roteador do Next, o piso do App Router), todo `async` (não bloqueia a pintura).

### Medição (Lighthouse 13, mobile, Caddy local, capa provisória, ainda com o YouTube)

| Categoria      | Nota                                                               |
| -------------- | ------------------------------------------------------------------ |
| Performance    | 96                                                                 |
| Acessibilidade | 100                                                                |
| Boas práticas  | 96 (aviso de cookie do iframe do player, que carrega com a página) |
| SEO            | 63, de propósito (`noindex`)                                       |

FCP 0,8s · LCP 2,8s (a capa) · TBT 0ms · CLS 0.
Capa definitiva: **WebP 720×1280, 41KB** (a provisória medida acima tinha 59KB em JPG).
A capa fica guardada no navegador por 1 ano (`next.config.ts`): para trocá-la, use um nome novo
(`poster-v3.webp`), que o Zod do `page-config` exige.

## Segurança

| Risco              | Mitigação                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XSS                | Sem `dangerouslySetInnerHTML` (regra do Biome como erro); textos vêm do config e o React escapa. CSP básica nos labels do Caddy (`object-src`, `base-uri`, `frame-ancestors`, `form-action`), sem `script-src`: o Next usa scripts inline, e a CSP com hashes só funcionava no antigo export estático.                                                                                                                                                  |
| Open redirect      | Destino do botão validado com Zod: só `https://rastrewin.com`, sem porta nem credenciais.                                                                                                                                                                                                                                                                                                                                                               |
| Clickjacking       | `X-Frame-Options: DENY` + `frame-ancestors 'none'`.                                                                                                                                                                                                                                                                                                                                                                                                     |
| Terceiros          | O iframe do Vimeo (`player.vimeo.com`), pré-carregado depois de a página abrir, e o script de rastreamento `https://track.rastrewin.com/t.js` (nosso, assíncrono), que carrega o Pixel da Meta e o Google Analytics das contas ativas no painel do track. O player manda ao track (só ao track, nunca à Meta ou ao GA4) o progresso do vídeo para a aba Vídeos: no play, a cada 15 s tocando, na pausa, no fim e ao sair (`src/lib/video-tracking.ts`). |
| Privacidade (LGPD) | O `t.js` grava cookies próprios em `.rastrewin.com` (`_trck`, identificador aleatório do visitante; `_fbc`/`_fbp`) e as UTMs no `localStorage`, para ligar a compra no rastrewin.com ao anúncio. O `localStorage` também guarda "botão liberado". O Vimeo recebe a visita e grava cookies de estatística (sem `dnt`, por escolha). A política de privacidade da Rastrewin cita a medição de anúncios; deve citar também o Vimeo.                        |
| Supply chain       | Poucas dependências, versões fixas, lockfile, `minimumReleaseAge` do Bun, `bun audit`; ações de terceiros do CI fixadas por hash de commit (as do `hyoretsu/gh-actions`, do mantenedor do projeto, seguem em `@main`).                                                                                                                                                                                                                                  |
| Container          | Sem root (`USER node`), read-only, `cap_drop: ALL`, `no-new-privileges` (`compose.yml`), sem portas publicadas.                                                                                                                                                                                                                                                                                                                                         |
| Indexação          | `noindex` (meta + `X-Robots-Tag`). Sem bloqueio no robots.txt, para o noindex ser lido.                                                                                                                                                                                                                                                                                                                                                                 |

### Quando o botão é liberado

| Situação                                                                   | Libera? | Fica lembrado na próxima visita? |
| -------------------------------------------------------------------------- | ------- | -------------------------------- |
| Assistiu `unlockAtSeconds` segundos (só avanço normal; pulos não contam)   | Sim     | Sim                              |
| Assistiu até o fim (vídeo mais curto que `unlockAtSeconds`)                | Sim     | Sim                              |
| Vimeo deu erro (vídeo removido, indisponível)                              | Sim     | Não                              |
| Vimeo não carregou em 15s (rede travada, bloqueador, domínio não liberado) | Sim     | Não                              |

O delay é um recurso de persuasão, não de segurança. Travar o botão quando o vídeo falha só
perderia a venda.

### Acessibilidade do player

- Até ficar pronto, o player fica `inert` (fora do Tab e do leitor de tela) e a capa é um botão
  "Assistir ao vídeo". Pronto, o Tab chega ao play do Vimeo, embaixo da capa, e o quadro mostra o anel
  de foco. Tocar na capa pelo teclado leva o foco ao player quando ele fica pronto; em erro, a "Tentar de novo".
- Pausar, continuar e o carregamento durante o vídeo são os do próprio Vimeo.
