# Tests

Pre-commit formats and lints staged files and type-checks affected workspaces. Unit suites exist only where the projects already had them:

- `vsl`: `bun run --cwd vsl test` (Vitest). The Docker build also runs it, so a broken test does not publish an image.
- `track`: `bun run --cwd track test` (node:test through tsx). `test:rls` and `test:retention` need a disposable Postgres with the migrations applied.

`bun run test` at the root runs every workspace that defines `test`. Do not add unit tests or coverage gates to `backend` or `frontend` without asking.
