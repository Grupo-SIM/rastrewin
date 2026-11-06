# VSL Rastrewin

Página de VSL (título, subtítulo, vídeo vertical do Vimeo, botão com delay e rodapé) que antecede
https://rastrewin.com. Fica em **vsl.rastrewin.com**. Conteúdo **estático**: sem backend e sem banco. A única coleta é
o script do track (`t.js`, ver `src/config/track.ts`), que registra o visitante, a origem do anúncio e o PageView, e o
progresso do vídeo que o player manda ao track pelo comando `trck('video')` (`src/lib/video-tracking.ts`: no play, a cada
15 s tocando, na pausa, no fim e ao sair da página). Esse progresso vai só para a aba Vídeos do painel, nunca à Meta ou ao
GA4. A medição nunca pode afetar o player nem o botão: o envio fica em `try/catch`, e a regra de liberar o botão é separada.

## Stack

- Next.js 16 (App Router, `output: "standalone"`) + React 19 + TypeScript estrito (6.x, a última suportada pelo Next).
- Tailwind CSS 4 + shadcn/ui (`src/components/ui/`).
- Zod 4: única fonte de verdade dos schemas (config da página em `src/config/`).
- Lint (Biome + ESLint) e formatação (`bun fmt`) pela raiz do monorepo; Vitest (testes).
- Bun 1.4 como gerenciador de pacotes e executor de scripts (Next e Vitest rodam no Node 24).
  Workspace `vsl` do monorepo Rastrewin (raiz do repositório: `bun install`, hooks, Turbo e CI).
- Deploy: GitHub Actions publica a imagem no GHCR (`ghcr.io/grupo-sim/rastrewin_vsl`, amd64 + arm64) a cada
  push na `main`; a VM (Komodo) só baixa e roda. Servidor Next.js standalone, atrás do caddy-docker-proxy central (HTTPS).
- A VSL não usa o `backend/` do monorepo: é estática e independente dele.

## Comandos (dentro de `vsl/`, ou `bun --cwd vsl <script>` a partir da raiz)

Requer Bun 1.4.4 (`npm i -g bun@1.4.4`) e Node 24.

| Ação                               | Comando                           |
| ---------------------------------- | --------------------------------- |
| Instalar                           | `bun install`                     |
| Dev                                | `bun run dev`                     |
| Typecheck                          | `bun run check-types`             |
| Testes                             | `bun run test`                    |
| Lint/format (na raiz do monorepo)  | `bun run lint` / `bun run format` |
| Build (gera `.next/`)              | `bun run build`                   |
| Auditoria de dependências          | `bun audit`                       |
| Novo componente shadcn (em `vsl/`) | `bunx shadcn@4.22.1 add <nome>`   |

O CLI do shadcn **não** é dependência do projeto (roda via `bunx`); o pacote `cn` (do próprio shadcn)
substitui `clsx` + `tailwind-merge`. Componentes novos do shadcn importam o pacote `radix-ui` inteiro
(~60 pacotes): troque pelo pacote específico (ex.: `@radix-ui/react-slot`), como no `button.tsx`.

## Onde editar o conteúdo

Tudo que muda com frequência (ID do vídeo, segundo de liberação do botão, textos, link de destino)
fica em `src/config/page-config.ts`, validado com Zod no build. Valor inválido = build quebra.

## Convenções

- Textos de interface e mensagens em português.
- Mobile-first; conferir 320px, 360px, 768px, 1280px e celular deitado (ex.: 844×390). Foco visível,
  contraste WCAG AA, `aria-*` corretos.
- Celular deitado (tela deitada com até 512px de altura): variante `landscape-short:` (em `globals.css`),
  com texto e botão à esquerda e vídeo à direita, para o play caber sem rolar.
- Identidade visual da Rastrewin: tokens em `src/app/globals.css`.
- Nada de `dangerouslySetInnerHTML`. Nenhum segredo no código; nenhuma variável sensível `NEXT_PUBLIC_`.
- Terceiros: o player do Vimeo (iframe `player.vimeo.com`), pré-carregado só depois de a página abrir (nunca com
  economia de dados ou 2G), e o Pixel da Meta e o GA4, que o `t.js` (nosso, `async` no `<head>`) carrega a partir
  das contas ativas no painel do track. Não adicione outros scripts de terceiros.
- Antes de adicionar dependência: justificar e preferir o que já existe. Lockfile sempre commitado.
- `bunfig.toml` (raiz do monorepo) aplica `minimumReleaseAge` (1 dia) e as dependências do `vsl` usam versões exatas: não abra exceções para versões
  recém-publicadas sem motivo.
- Testes rodam no Vitest via `bun run test` (não use `bun test`, que é o runner próprio do Bun).

## Regras de trabalho

1. **Plano primeiro**: mostrar arquivos, schemas, riscos e esperar aprovação.
2. **Uma mudança por vez**; não reformatar o que não foi tocado.
3. **Erros**: explicar a causa em linguagem simples antes de corrigir.
4. **Banco de dados**: nunca executar nada contra banco sem autorização explícita (este projeto não tem banco).
5. **Git**: Conventional Commits, um commit por mudança aprovada. **Nunca dar push sem revisão**,
   nunca `--no-verify` nem `--force`.
6. **Antes de entregar**: typecheck, Biome nos arquivos alterados, testes, build (se tocar layout/rotas)
   e resumo do que foi e do que não foi verificado.

## Deploy

`Dockerfile` e `compose.yml` ficam em `vsl/`; o build da imagem usa a raiz do monorepo como contexto
(`docker build -f vsl/Dockerfile .`). A imagem roda apenas Next.js standalone na porta 3000.
Os labels do Compose configuram o caddy-docker-proxy central pela rede Docker externa `caddy`.
`.github/workflows/cd.yml` (raiz do monorepo) publica a imagem no GHCR para amd64 e arm64.

## Guias

- [Estrutura do projeto](docs/development/project-scaffolding.md)
- [Deploy (VM + Komodo + Caddy)](docs/development/deploy.md)
- [Performance e segurança](docs/development/performance-e-seguranca.md)

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
