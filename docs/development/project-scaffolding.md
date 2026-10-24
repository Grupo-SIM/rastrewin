# Estrutura do projeto

```
.
├── CLAUDE.md               regras, stack e comandos
├── package.json            scripts da raiz (delegam para frontend/)
├── pnpm-workspace.yaml     workspaces do pnpm
├── biome.json              lint + format
├── frontend/               Next.js (export estático)
│   ├── next.config.ts
│   ├── src/app/            rotas (App Router)
│   ├── src/components/     componentes (ui/ = shadcn)
│   ├── src/config/         configuração validada com Zod
│   ├── src/lib/            funções puras e utilitários
│   └── public/             arquivos estáticos (logo, capa, robots.txt)
├── deploy/                 Dockerfile, Caddyfile, compose (Komodo)
├── docs/development/       guias
├── plans/                  planos aprovados
└── scripts/                scripts auxiliares (ex.: hashes de CSP)
```

## Ao criar um novo workspace
1. Crie a pasta na raiz (ex.: `backend/` ou `packages/schemas/`) com seu `package.json` (`"private": true`).
2. Adicione o caminho em `pnpm-workspace.yaml`.
3. TypeScript estrito, como em `frontend/tsconfig.json`.
4. Adicione scripts `typecheck`, `test` e (se aplicável) `build`, e exponha-os no `package.json` da raiz.
5. Atualize o `CLAUDE.md`.

## Versões
- Sempre a versão estável mais recente, **desde que passe** na política `minimumReleaseAge` do pnpm
  (versões publicadas há poucas horas ficam de fora até amadurecerem).
- Versões fixas (sem `^`) nas dependências principais.
