# Business Rules

Source of truth for product and domain rules. Keep engineering workflow and agent rules in `AGENTS.md`.

## Products

- **Rastrewin raffles** (`frontend`, `backend`): landing, sign-up and checkout; `/dashboard` with the user's raffles; `/admin` where the admin defines each raffle's winner. A winner is shown to the user only when the raffle time is over **and** the admin has set one; otherwise the UI shows "Apurando resultado...". Raffle data is mocked.
- **Tracking** (`track`): server-side tracking that captures visitors and events, sends them to Meta Conversions API and GA4, receives sales relayed by the rastrewin backend and shows everything in a panel. Its rules (RLS, secrets, retention, geolocation attribution) live in [`track/AGENTS.md`](../track/AGENTS.md) and [`track/SECURITY.md`](../track/SECURITY.md).
- **VSL page** (`vsl`): static video sales letter page that precedes https://rastrewin.com, served at vsl.rastrewin.com. No backend and no database; it loads the track script (`t.js`) to record the visitor and the ad origin. Rules live in [`vsl/AGENTS.md`](../vsl/AGENTS.md).

## Sales and attribution

- Funnel: ad → VSL → rastrewin.com sign-up form → SimIntPay checkout (a payment link per plan).
- Both sites load `https://track.rastrewin.com/t.js`. Visits from the Meta and Google networks (ad review and link-preview robots that run the page) are ignored by the track: they are not visitors and nothing is sent to Meta/GA4 for them. The visitor id cookie (`_trck`) is set on `.rastrewin.com`, so the VSL and rastrewin.com share the visitor.
- On submit, the form identifies the lead and sends `InitiateCheckout` to the track. It also sends the visitor's tracking (`src` = `trck_user_id`, UTMs, `fbc`, `fbp`) with the sign-up; the backend stores it.
- SimIntPay sends each sale event to the backend, which confirms the purchase and relays the event to the track. The track ties the sale to the visit through `src`, falling back to e-mail or phone. Details: [SimIntPay integration](development/simintpay.md).
- Only the first purchase goes to Meta and GA4 as `Purchase`. Repurchases and renewals (the buyer already had a paid order) show only in the track's Faturamento and stay out of campaign ROAS.
- Refund and chargeback revoke the plan of the order that was refunded. The track marks the sale refunded and sends a GA4 `refund`; Meta receives nothing for refunds.
- Once a sale is approved, its value, product, UTMs and visitor link are fixed. Later events for the same order (refund requested, refund, chargeback) change only the status and the refund date, so the amount they carry never rewrites revenue and the tracking the backend attaches to them never moves the sale to another campaign. Only a new approval of the same order can update those fields. Each raw event stays in `webhook_events`.
- Every track event carries the same UTMs as `identify`, so an event that reaches the server before `identify` (the first PageView) still records its origin.

## Panel analytics (track)

- **Meta spend when the detail is cut:** the ad-level insights stop at 10 pages (5,000 ad × day rows). When Meta still had more rows, the track fetches the account totals (one small account-level call) and uses them for spend, ROAS, CPA and the daily chart in Campanhas and Visão geral; the campaign tree stays partial and the panel shows a warning. If even the account totals fail, the warning says the spend shown is below the real one.
- **Visão geral:** "Gasto" is the Meta Ads spend of all active ad accounts, read through the same cache and rate limit as Campanhas (no extra Meta call when either tab already loaded the period). "ROAS" here is the overall ROAS: total revenue of the period ÷ spend, including sales that did not come from ads; the campaign-attributed ROAS (UTM) stays in Campanhas.
- **Páginas:** conversion per page, where a page is the domain + path without query string (UTMs, `fbclid`) or trailing slash. A person counts on **every** page they viewed in the period, so a buyer who saw the VSL and the sign-up page counts on both and the rows do not add up to the total. Checkout = viewers who fired `InitiateCheckout` in the period; purchases = viewers' approved sales in the period, renewals excluded (same rules as Faturamento).
- **Vídeos:** retention of the VSL video. The VSL reports each play's progress (`trck('video')`): furthest point reached, seconds really watched (skips and replays don't count), the end and the second the button unlocks. One row per play in `video_views`. Play rate = plays ÷ PageViews of the video's page, counting PageViews only from the video's first recorded play (before it, plays could not be measured, so older views would lower the rate); the ⓘ shows that start when it falls inside the period. How to read the tab and why it is calculated this way: [track/docs/aba-videos.md](../track/docs/aba-videos.md). This data stays in the panel: it never goes to Meta or GA4 and is not an event (`events_log`, the overview's "Eventos" KPI and the funnel are unchanged).
- **Daily cleanup does not change the numbers:** it only empties the four technical JSON payloads of `events_log` rows older than 14 days (what was sent to and received from Meta/GA4). Event rows, URLs, visitors, purchases and video plays are kept, so KPIs, funnel, Páginas, Vídeos, campaigns/ROAS and the sale → visitor link are unaffected. After 14 days the event detail shows empty JSON tabs and Meta status "expirado".

## Open points

Surface open points instead of guessing; add normative rules here as they are confirmed.
