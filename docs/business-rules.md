# Business Rules

Source of truth for product and domain rules. Keep engineering workflow and agent rules in `AGENTS.md`.

## Products

- **Rastrewin raffles** (`frontend`, `backend`): landing, sign-up and checkout; `/dashboard` with the user's raffles; `/admin` where the admin defines each raffle's winner. A winner is shown to the user only when the raffle time is over **and** the admin has set one; otherwise the UI shows "Apurando resultado...". Raffle data is mocked.
- **Tracking** (`track`): server-side tracking that captures visitors and events, sends them to Meta Conversions API and GA4, receives sales from SimIntPay by webhook and shows everything in a panel. Its rules (RLS, secrets, retention, geolocation attribution) live in [`track/AGENTS.md`](../track/AGENTS.md) and [`track/SECURITY.md`](../track/SECURITY.md).
- **VSL page** (`vsl`): static video sales letter page that precedes https://rastrewin.com, served at vsl.rastrewin.com. No backend, no database, no data collection. Rules live in [`vsl/AGENTS.md`](../vsl/AGENTS.md).

## Open points

Surface open points instead of guessing; add normative rules here as they are confirmed.
