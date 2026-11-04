# Continuous delivery

- `.github/workflows/ci.yml` (pull requests) computes affected workspaces with Turbo and runs build, check-types and test for each.
- `.github/workflows/cd.yml` publishes the images as `ghcr.io/<owner>/rastrewin_<service>` on push to `main`, on manual dispatch and monthly:
    - `backend`, `frontend` and `track` → `rastrewin_backend`, `rastrewin_frontend`, `rastrewin_track` (linux/amd64). The monthly run rebuilds it with a new `GEO_MONTH` so the DB-IP geolocation base is refreshed.
    - `vsl` → `rastrewin_vsl` (linux/amd64 and linux/arm64).
    - Only affected projects are published on push (`scripts/affected-packages.ts`); dispatch accepts `all`, `backend`, `frontend`, `track` or `vsl`.
    - Tags: `latest` (default branch) and `sha-<short commit>`; use the sha tag to roll back.
- `compose.production.yaml` pulls the `backend` and `frontend` images (`IMAGE_TAG` defaults to `latest`). The frontend build reads the `NEXT_PUBLIC_API_URL` repository variable.
- `.github/workflows/codeql.yml` runs CodeQL for Actions and JavaScript/TypeScript.

Deployment itself (pulling the new image in Komodo) stays outside the workflows. Production stacks: `compose.production.yaml`, `track/deploy/docker-compose.yml`, `vsl/compose.yml`.
