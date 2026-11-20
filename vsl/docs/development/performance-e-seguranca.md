# Performance e segurança

## Performance

- **Estático:** HTML pré-renderizado no build (título, subtítulo, capa e logo aparecem sem esperar JS).
- **Um único play, o do próprio Vimeo:** o iframe do Vimeo (~550KB) vem no HTML e começa a carregar junto
  com a página, para todos (inclusive com economia de dados ou 2G). Enquanto não fica pronto, ele fica
  invisível e fora do Tab, por cima da capa do site (uma imagem, que aparece na hora), com o carregamento no
  centro. Pronto, o player aparece com o play dele no centro: um toque e o vídeo começa. A capa do vídeo no
  Vimeo é a mesma imagem da capa do site, então a troca não aparece. A biblioteca `@vimeo/player` (~8KB
  comprimida) vem do próprio site quando a página fica ativa e só liga a medição ao iframe.

    Por que assim (medido em 19/11/2026, celular intermediário simulado, 4G e CPU 4x): com a capa do site
    por cima e o player carregado só depois de a página abrir, quem tocava antes de o player ficar pronto
    precisava de um 2º toque (sempre 2 toques, vídeo andando em ~4 a 7 s). Com o iframe no HTML e o play do
    Vimeo, é sempre 1 toque e o vídeo anda ~0,6 a 2 s antes. O play é o do Vimeo porque o iPhone só libera o
    som quando o toque acontece dentro do documento do vídeo (um play pedido pela página sai mudo).

    O player do Vimeo mostra só o play (`progress_bar=0`, `skipping_forward=0`, sem volume, tela cheia,
    qualidade, legendas, logo), na cor `--ink`. Pausar e continuar é tocar no vídeo, pelo próprio Vimeo.

    Se o player não ficar pronto em 15 s (rede travada, bloqueador), o botão é liberado (`VSLCTAUnlock` com
    `reason: error`) e o player continua carregando: se ficar pronto depois, aparece normalmente. Erro do
    próprio Vimeo mostra "Não foi possível carregar o vídeo" e também libera o botão.

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

| Risco              | Mitigação                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XSS                | Sem `dangerouslySetInnerHTML` (regra do Biome como erro); textos vêm do config e o React escapa. CSP básica nos labels do Caddy (`object-src`, `base-uri`, `frame-ancestors`, `form-action`), sem `script-src`: o Next usa scripts inline, e a CSP com hashes só funcionava no antigo export estático.                                                                                                                                                                                                                                                                                                                                                                                                  |
| Open redirect      | Destino do botão validado com Zod: só `https://rastrewin.com`, sem porta nem credenciais.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Clickjacking       | `X-Frame-Options: DENY` + `frame-ancestors 'none'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Terceiros          | O iframe do Vimeo (`player.vimeo.com`), que vem no HTML e carrega junto com a página, e o script de rastreamento `https://track.rastrewin.com/t.js` (nosso, assíncrono), que carrega o Pixel da Meta e o Google Analytics das contas ativas no painel do track. O player manda ao track (só ao track, nunca à Meta ou ao GA4) o progresso do vídeo para a aba Vídeos: no play, a cada 15 s tocando, na pausa, no fim e ao sair (`src/lib/video-tracking.ts`).                                                                                                                                                                                                                                           |
| Privacidade (LGPD) | O `t.js` grava cookies próprios em `.rastrewin.com` (`_trck`, identificador aleatório do visitante; `_fbc`/`_fbp`) e as UTMs no `localStorage`, para ligar a compra no rastrewin.com ao anúncio. O `localStorage` também guarda "botão liberado". O Vimeo recebe a visita (IP e navegador, como todo player embutido), mas o player abre com `dnt=1` (`src/lib/vimeo-player.ts`): não grava cookies (ex.: `vuid`) nem dados de sessão, porque abre antes da resposta ao banner. Efeito: as estatísticas do próprio Vimeo deixam de contar essas visitas; a medição do vídeo é a aba Vídeos do track. A política de privacidade da Rastrewin cita a medição de anúncios e o Vimeo (seções 3, 4, 6 e 12). |
| Supply chain       | Poucas dependências, versões fixas, lockfile, `minimumReleaseAge` do Bun, `bun audit`; ações de terceiros do CI fixadas por hash de commit (as do `hyoretsu/gh-actions`, do mantenedor do projeto, seguem em `@main`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Container          | Sem root (`USER node`), read-only, `cap_drop: ALL`, `no-new-privileges` (`compose.yml`), sem portas publicadas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Indexação          | `noindex` (meta + `X-Robots-Tag`). Sem bloqueio no robots.txt, para o noindex ser lido.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

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
