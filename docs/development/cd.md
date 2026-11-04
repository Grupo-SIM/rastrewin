# Continuous delivery

- `.github/workflows/ci.yml` (pull requests) computes affected workspaces with Turbo and runs build, check-types and test for each.
- `.github/workflows/cd.yml` publishes GHCR images on push to `main`, on manual dispatch and monthly:
    - `track` → `ghcr.io/<owner>/rastrewin` (linux/amd64). The monthly run rebuilds it with a new `GEO_MONTH` so the DB-IP geolocation base is refreshed.
    - `vsl` → `ghcr.io/<owner>/vslrastrewin` (linux/amd64 and linux/arm64).
    - Only affected projects are published on push (`scripts/affected-packages.ts`); dispatch accepts `all`, `track` or `vsl`.
    - Tags: `latest` (default branch) and `sha-<short commit>`; use the sha tag to roll back.
- `backend` and `frontend` are built by the deployment stack from `compose.production.yaml` (context: repository root).
- `.github/workflows/codeql.yml` runs CodeQL for Actions and JavaScript/TypeScript.

Deployment itself (pulling the new image in Komodo) stays outside the workflows. Production stacks: `compose.production.yaml`, `track/deploy/docker-compose.yml`, `vsl/compose.yml`.
