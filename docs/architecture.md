# Architecture

Bun workspaces monorepo orchestrated by Turborepo (`turbo.jsonc`). Each project keeps its own framework.

| Workspace  | Stack                                        | Deploy                                                     |
| ---------- | -------------------------------------------- | ---------------------------------------------------------- |
| `backend`  | NestJS 10, Prisma 5, PostgreSQL              | GHCR image `rastrewin_backend`, `compose.production.yaml`  |
| `frontend` | Next.js 14, React 18                         | GHCR image `rastrewin_frontend`, `compose.production.yaml` |
| `track`    | Next.js 16, Drizzle, better-auth, PostgreSQL | GHCR image `rastrewin_track`, stack in `track/deploy/`     |
| `vsl`      | Next.js 16, Tailwind 4, shadcn/ui, Vitest    | GHCR image `rastrewin_vsl`, stack in `vsl/compose.yml`     |

`frontend` talks to `backend` over HTTP (`NEXT_PUBLIC_API_URL`); the other projects are independent of each other and share only tooling.

## Local development

- `bun install` at the root (installs Lefthook hooks through `prepare`).
- `bun run db:up` starts the local Postgres for `backend` (`compose.yaml`, port 5436), then `bun run db:push` and `bun run db:seed`.
- `bun run dev` starts every project; use `bun run dev:backend|dev:frontend|dev:track|dev:vsl` for one. Copy each project's `.env.example` to `.env` first.
- `backend` runs on `:3011`, `frontend` on `:3000`; run `track` or `vsl` alone to avoid clashing ports (both default to `:3000`).

## Images

All Dockerfiles use the repository root as build context: `docker build -f <project>/Dockerfile .`. Next.js standalone output is traced from the repository root, so each server starts at `<project>/server.js`.
