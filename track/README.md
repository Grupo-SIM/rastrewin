# Rastrewin — tracking server-side

Captura visitantes e eventos, envia para Meta Conversions API e GA4, recebe as vendas do SimIntPay (repassadas pelo backend do rastrewin, ver [docs/development/simintpay.md](../docs/development/simintpay.md)) e mostra tudo num painel.

- Regras, stack e status das fases: veja [CLAUDE.md](CLAUDE.md).
- Rodar local: `cp .env.example .env` → preencha → `docker compose up -d --build` → http://localhost:3000
- **Colocar no ar (VPS):** [docs/go-live.md](docs/go-live.md). Segurança: [SECURITY.md](SECURITY.md).
- Imagem publicada pelo GitHub Actions em `ghcr.io/<owner>/rastrewin_track`. O banco usa o `postgres:18` oficial.
