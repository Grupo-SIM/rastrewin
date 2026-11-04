# Rastrewin

Monorepo (Bun workspaces + Turborepo):

| Workspace  | What                                                       |
| ---------- | ---------------------------------------------------------- |
| `backend`  | NestJS + Prisma API of the raffles product (`:3011`)       |
| `frontend` | Next.js web app of the raffles product (`:3000`)           |
| `track`    | Server-side tracking (Meta CAPI, GA4, SimIntPay) and panel |
| `vsl`      | Static VSL page at vsl.rastrewin.com                       |

## Run

```bash
bun install
bun run db:up      # Postgres via Docker (port 5436)
bun run db:push    # create tables
bun run db:seed    # 48 mocked raffles (8 end in a few minutes)
bun run dev        # everything; or dev:backend, dev:frontend, dev:track, dev:vsl
```

- `/` landing + sign-up + checkout; `/dashboard` the user's raffles; `/admin` defines each raffle's winner.
- Copy each project's `.env.example` to `.env` first.
- Docs: [architecture](docs/architecture.md), [engineering rules](docs/engineering-rules.md), [business rules](docs/business-rules.md).
