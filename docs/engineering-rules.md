# Engineering rules

Read before implementation or review. These rules supplement [AGENTS.md](../AGENTS.md); product rules are in [business-rules.md](business-rules.md).

## Stack

- Bun 1.4.4 owns installs (`bun.lock` is the only lockfile), scripts and formatting. Never use npm or commit `package-lock.json`.
- Turborepo runs `build`, `check-types`, `dev`, `generate` and `test` across workspaces; workspace scripts call the real tools, never Turbo.
- Each project keeps its framework: NestJS + Prisma (`backend`), Next.js (`frontend`, `track`, `vsl`). Do not migrate a project to the template's Elysia/Vite stack.
- Workspace names are `backend`, `frontend`, `track` and `vsl`. Import across workspaces by package name with `workspace:*`; none do today.

## Formatting and linting

Bun formats through the root `bunfig.toml` `[fmt]` section (`bun run format`, `bun run format:check`). `bun run lint` runs Biome (`<project>/biome.json` extends the matching `@hyoretsu/configs` preset) and ESLint (root `eslint.config.mjs`). Biome formatting, import organization and class sorting stay disabled so they cannot conflict with Bun. The pre-commit hook runs them on staged files.

## Type-checking

Each workspace defines `check-types`. `backend` needs the Prisma client first (`generate` runs through Turbo's dependency edge); `track` runs `next typegen` before `tsc`. Pre-commit type-checks only the staged workspaces and their dependents (`scripts/validate-staged.ts`).

## Tests

`vsl` (Vitest) and `track` (node:test via tsx) keep their existing unit suites and run them through `bun run test`. `track` also has database scenarios (`test:rls`, `test:retention`) that need a disposable Postgres. Never run them against a remote or shared database.

## Database

- `backend`: Prisma schema in `backend/prisma/schema.prisma`; `db push` is used by the container start, without `--accept-data-loss`.
- `track`: Drizzle migrations in `track/drizzle`, applied by `track/scripts/migrate.ts`.
- Never run migrations, pushes or seeds against remote or shared databases without explicit authorization.

## Generated files

`track/public/t.js` is generated from `track/src/tracker/trck.ts` (`tracker:build`, run by `predev` and `prebuild`). Do not edit it. `scripts/agent-hooks/block-generated-edits.ts` blocks such edits for Claude Code and Codex.

## Continuous delivery

See [CD guide](development/cd.md).
