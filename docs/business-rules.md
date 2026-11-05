# Business Rules

Source of truth for product and domain rules. Keep engineering workflow and agent rules in `AGENTS.md`.

## Products

- **Rastrewin raffles** (`frontend`, `backend`): landing, sign-up and checkout; `/dashboard` with the user's raffles; `/admin` where the admin defines each raffle's winner. A winner is shown to the user only when the raffle time is over **and** the admin has set one; otherwise the UI shows "Apurando resultado...". Raffle data is mocked.
- **Tracking** (`track`): server-side tracking that captures visitors and events, sends them to Meta Conversions API and GA4, receives sales relayed by the rastrewin backend and shows everything in a panel. Its rules (RLS, secrets, retention, geolocation attribution) live in [`track/AGENTS.md`](../track/AGENTS.md) and [`track/SECURITY.md`](../track/SECURITY.md).
- **VSL page** (`vsl`): static video sales letter page that precedes https://rastrewin.com, served at vsl.rastrewin.com. No backend and no database; it loads the track script (`t.js`) to record the visitor and the ad origin. Rules live in [`vsl/AGENTS.md`](../vsl/AGENTS.md).

## Sales and attribution

- Funnel: ad → VSL → rastrewin.com sign-up form → SimIntPay checkout (a payment link per plan).
- Both sites load `https://track.rastrewin.com/t.js`. The visitor id cookie (`_trck`) is set on `.rastrewin.com`, so the VSL and rastrewin.com share the visitor.
- On submit, the form identifies the lead and sends `InitiateCheckout` to the track. It also sends the visitor's tracking (`src` = `trck_user_id`, UTMs, `fbc`, `fbp`) with the sign-up; the backend stores it.
- SimIntPay sends each sale event to the backend, which confirms the purchase and relays the event to the track. The track ties the sale to the visit through `src`, falling back to e-mail or phone. Details: [SimIntPay integration](development/simintpay.md).
- Only the first purchase goes to Meta and GA4 as `Purchase`. Repurchases and renewals (the buyer already had a paid order) show only in the track's Faturamento and stay out of campaign ROAS.
- Refund and chargeback revoke the plan of the order that was refunded. The track marks the sale refunded and sends a GA4 `refund`; Meta receives nothing for refunds.

## Open points

Surface open points instead of guessing; add normative rules here as they are confirmed.
