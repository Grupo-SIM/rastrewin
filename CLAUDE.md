# VSL Rastrewin

Página de VSL (título, subtítulo, vídeo vertical do YouTube, botão com delay e rodapé) que antecede
https://rastrewin.com. Fica em **vsl.rastrewin.com**. Site **100% estático**: sem backend, sem banco,
sem coleta de dados, sem pixel/UTM (rastreamento será tratado em outro momento).

## Stack
- Next.js 16 (App Router, `output: "export"`) + React 19 + TypeScript estrito (6.x, a última suportada pelo Next).
- Tailwind CSS 4 + shadcn/ui (`frontend/src/components/ui/`).
- Zod 4: única fonte de verdade dos schemas (config da página em `frontend/src/config/`).
- Biome (lint + format), Vitest (testes).
- pnpm 12 (via Corepack), monorepo enxuto: `frontend/`, `docs/`, `plans/`, `scripts/`, `deploy/`.
- Deploy: VM própria com Komodo; container Caddy interno serve `out/`, atrás do Caddy central (HTTPS).
- Sem `backend/` e sem `packages/schemas` por enquanto. Se entrar backend (NestJS + Prisma + PostgreSQL),
  os schemas Zod migram para `packages/schemas`.

## Comandos (na raiz)
Use `corepack pnpm …` se o `pnpm` não estiver no PATH (ou rode `corepack enable pnpm` uma vez).

| Ação | Comando |
| --- | --- |
| Instalar | `pnpm install` |
| Dev | `pnpm dev` |
| Typecheck | `pnpm typecheck` |
| Testes | `pnpm test` |
| Lint/format | `pnpm lint` / `pnpm format` |
| Build estático (gera `frontend/out/`) | `pnpm build` |
| Novo componente shadcn (em `frontend/`) | `pnpm dlx shadcn@4.22.1 add <nome>` |

O CLI do shadcn **não** é dependência do projeto (roda via `dlx`); o pacote `cn` (do próprio shadcn)
substitui `clsx` + `tailwind-merge`.

## Onde editar o conteúdo
Tudo que muda com frequência (ID do vídeo, segundo de liberação do botão, textos, link de destino)
fica em `frontend/src/config/page-config.ts`, validado com Zod no build. Valor inválido = build quebra.

## Convenções
- Textos de interface e mensagens em português.
- Mobile-first; conferir 360px, 768px e 1280px. Foco visível, contraste WCAG AA, `aria-*` corretos.
- Identidade visual da Rastrewin: tokens em `frontend/src/app/globals.css`.
- Nada de `dangerouslySetInnerHTML`. Nenhum segredo no código; nenhuma variável sensível `NEXT_PUBLIC_`.
- Nenhum script de terceiros antes de a pessoa tocar no vídeo.
- Antes de adicionar dependência: justificar e preferir o que já existe. Lockfile sempre commitado.
- O pnpm aplica `minimumReleaseAge`: não abra exceções para versões recém-publicadas sem motivo.

## Regras de trabalho
1. **Plano primeiro**: mostrar arquivos, schemas, riscos e esperar aprovação.
2. **Uma mudança por vez**; não reformatar o que não foi tocado.
3. **Erros**: explicar a causa em linguagem simples antes de corrigir.
4. **Banco de dados**: nunca executar nada contra banco sem autorização explícita (este projeto não tem banco).
5. **Git**: Conventional Commits, um commit por mudança aprovada. **Nunca dar push sem revisão**,
   nunca `--no-verify` nem `--force`.
6. **Antes de entregar**: typecheck, Biome nos arquivos alterados, testes, build (se tocar layout/rotas)
   e resumo do que foi e do que não foi verificado.

## Guias
- [Estrutura do projeto](docs/development/project-scaffolding.md)
