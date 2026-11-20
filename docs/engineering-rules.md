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

`vsl` (Vitest) and `track` (node:test API run by `bun test`) keep their existing unit suites and run them through `bun run test`. `track` also has database scenarios (`test:rls`, `test:retention`) that need a disposable Postgres. Never run them against a remote or shared database.

## Database

- `backend`: Prisma schema in `backend/prisma/schema.prisma`; `db push` is used by the container start, without `--accept-data-loss`.
- `track`: Drizzle migrations in `track/drizzle`, applied by `track/scripts/migrate.ts`.
- Never run migrations, pushes or seeds against remote or shared databases without explicit authorization.

## Security (backend, frontend)

- **Identity comes from the token, never from the URL.** Customer routes (`/users/me`, `/users/me/otp`, `/raffles/*`, `/auth/change-password`) use `AuthGuard`; `/admin/*` uses `AdminGuard`. Both read the account from the database: the JWT (`HS256`, 7 days, `iss`/`aud`) only proves who and which `tokenVersion`; the role comes from the row. Changing or resetting the password bumps `tokenVersion` and drops every other session. Never add a route that takes a user id from the query or path to decide whose data to return.
- **Responses are allow-lists.** `toPublicUser` (the user's own view) and `toAdminUser` list the fields that may leave; a new column never leaks by omission. The raffle winner id never goes out, only `mine`.
- **Public routes have limits and size caps.** Every unauthenticated route has its own `createRateLimiter` (see `enforce`) on top of the global 300/min per IP in `main.ts`; DTOs set `@MaxLength` and formats, and `ValidationPipe` uses `forbidNonWhitelisted`. Webhook bodies are validated by hand (the Evolution shape varies).
- **Reset codes:** at most 10 wrong codes per account per hour (`resetAttempts` is counted before comparing and is not reset by a new code), plus per-IP limits.
- **Admin 2FA:** TOTP (`/auth/totp/setup`, `/auth/totp/enable`, button "2FA" in `/admin`); once on, login requires the code and a code is accepted once (`totpLastStep`). The seed never changes an existing admin password (`ADMIN_RESET_PASSWORD=true` once to reset it, which also clears the 2FA).
- **Secrets:** `JWT_SECRET` (32+ chars), optional `RESET_CODE_SECRET` and `PRIVACY_TOKEN_SECRET` (without them the JWT secret is used, with a different prefix per use), `WHATSAPP_WEBHOOK_SECRET` (the WhatsApp webhook refuses everything without it; register the same value in Evolution as the `x-webhook-secret` header or `?token=`), `SIMPAY_WEBHOOK_SECRET`. SMTP TLS is always verified (`SMTP_TLS_SERVERNAME` when the certificate is for another hostname).
- **Headers:** the API sets nosniff, frame-deny, HSTS and a `default-src 'none'` CSP; the frontend sets a CSP that allows only the track script and the Meta/GA4 hosts the track loads (`frontend/next.config.mjs`). No `X-Powered-By`.
- **Client IP** for limits is the last `X-Forwarded-For` entry; that holds only while the API is not behind Cloudflare and only trusted containers share the `proxy` network (see `backend/src/http/client-ip.ts`).
- **Test tools** (`POST /admin/raffles/:id/end` and its "Encerrar em 10s" button) are off in production unless `ENABLE_TEST_TOOLS=true` / `NEXT_PUBLIC_ENABLE_TEST_TOOLS=true`.
- **Dependencies:** `bun audit` runs in CI as an informational job. Remaining findings are development tools (`committier`, `@nestjs/cli`) that never enter an image.
- **Accepted risks:** `JWT_SECRET` shorter than 32 characters only logs a warning at boot (blocking it could take the API down on a deploy); keep the production value at 32+. The checkout URL (`backend/src/plans.ts`) carries the customer's CPF and phone as query parameters so SimIntPay opens prefilled: the processor needs them for the purchase, and the URL only goes from our API to the customer's browser and then to SimIntPay.
- **Audit:** `bun scripts/audit/index.ts` checks these rules in the code (`--producao` also checks the live sites, read-only; `--ferramentas` runs lint, types, tests, build and `bun audit`). Manual items: [audit checklist](audit-checklist.md).

## Generated files

`track/public/t.js` is generated from `track/src/tracker/trck.ts` (`tracker:build`, run by `predev` and `prebuild`). Do not edit it. `scripts/agent-hooks/block-generated-edits.ts` blocks such edits for Claude Code and Codex.

## Continuous delivery

See [CD guide](development/cd.md).
