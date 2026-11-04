# Performance e segurança

## Performance

- **Estático:** HTML pré-renderizado no build (título, subtítulo, capa e logo aparecem sem esperar JS).
- **Player pré-carregado:** a página abre só com a capa (uma imagem). Depois que ela termina de abrir
  e o navegador fica ocioso, o player do Vimeo (~550KB) carrega escondido atrás da capa, sem tocar.
  No toque, o vídeo começa em **~0,85s a 1,9s** (Wi-Fi, Chrome e Safari/WebKit, medido com o vídeo real).
  A biblioteca `@vimeo/player` (~8KB comprimida) vem do próprio site, só nesse momento.

    Sem pré-carregamento (carrega só no toque): economia de dados ligada, rede 2G e quem já liberou o
    botão em visita anterior. Se o navegador recusar o play com som ou o Vimeo começar mudo (no Safari e no
    iPhone é comum no 1º play), a capa volta com "Assistir com som": o 2º toque, com o player já pronto,
    toca com som em ~0,15s. Se sair mudo de novo (ou o Vimeo nem aceitar o pedido em 2s), o plano B troca o
    player pelo que tem o play do próprio Vimeo; nele a página não dá play sozinha, e o toque dentro do
    player é o que libera o som.

- **Fontes:** `next/font` serve Plus Jakarta Sans e Manrope do próprio domínio, só com os pesos usados.
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

| Risco              | Mitigação                                                                                                                                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XSS                | Sem `dangerouslySetInnerHTML` (regra do Biome como erro); textos vêm do config e o React escapa. CSP com hashes.                                                                                                                                               |
| Open redirect      | Destino do botão validado com Zod: só `https://rastrewin.com`, sem porta nem credenciais.                                                                                                                                                                      |
| Clickjacking       | `X-Frame-Options: DENY` + `frame-ancestors 'none'`.                                                                                                                                                                                                            |
| Terceiros          | Só o iframe do Vimeo (`player.vimeo.com`), pré-carregado depois de a página abrir. Nenhum script de terceiros na página (CSP sem origem externa em `script-src`).                                                                                              |
| Privacidade (LGPD) | Sem cookies próprios, sem coleta de dados. Só o `localStorage` guarda "botão liberado". O Vimeo recebe a visita e grava cookies de estatística (sem `dnt`, por escolha), mesmo de quem não dá play. A política de privacidade da Rastrewin deve citar o Vimeo. |
| Supply chain       | Poucas dependências, versões fixas, lockfile, `minimumReleaseAge` do Bun, `bun audit`; ações do CI fixadas por hash de commit.                                                                                                                                 |
| Container          | Sem root, read-only, `cap_drop: ALL`, `no-new-privileges`, sem portas publicadas.                                                                                                                                                                              |
| Indexação          | `noindex` (meta + `X-Robots-Tag`). Sem bloqueio no robots.txt, para o noindex ser lido.                                                                                                                                                                        |

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

- Ao dar play pelo teclado, o foco acompanha o player (quadro → "Pausar vídeo"; em erro, "Tentar de novo").
- Depois que o vídeo começa, o iframe do Vimeo fica fora da ordem do Tab (no plano B, antes disso, ele
  precisa ser alcançável, porque o play é o do próprio Vimeo).
  Pré-carregado atrás da capa, fica `inert` (fora do Tab e do leitor de tela) até o play.
- Durante o buffering aparece um spinner (e não o ícone de play).
