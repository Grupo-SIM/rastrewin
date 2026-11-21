# SimIntPay integration

How sales from SimIntPay reach the rastrewin `backend` and the `track`. Product rules are in [business-rules.md](../business-rules.md#sales-and-attribution).

## Webhook route

`POST https://api.rastrewin.com/payments/webhook` (`backend/src/payments/payments.controller.ts`).

Register it in SimIntPay, on the rastrewin platform:

| SimIntPay key    | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| `WEBHOOK_URL`    | `https://api.rastrewin.com/payments/webhook`             |
| `WEBHOOK_SECRET` | the same value as `SIMPAY_WEBHOOK_SECRET` in the backend |
| `INBOUND_TOKEN`  | the same value as `SIMPAY_INBOUND_TOKEN` (not used yet)  |

A payment link's own `webhookUrl` takes precedence over the platform `WEBHOOK_URL`. If a plan link has one, set it to the same route or leave it empty.

## Contract

The SimIntPay "sales API" (`Grupo-SIM/simintpay`: `docs/central-sales-api.md`):

- Signature: HMAC-SHA256 hex of the exact raw body in `x-simintpay-signature`, keyed with `SIMPAY_WEBHOOK_SECRET`. The backend boots with `rawBody: true`, compares in constant time and answers 401 without a secret or with a bad signature. Nothing is stored in that case.
- Events: `purchase_approved`, `purchase_refunded`, `chargeback`, `refund_requested`, `card_declined`, `pix_generated`, `pix_expired`. Values in cents; no CPF.
- Once the platform has a `WEBHOOK_SECRET`, SimIntPay stops sending the legacy `x-simpay-token` webhook for payment links. The backend no longer accepts it.
- Plans are sold as **annual subscription offers** since 2026-11-17: SimIntPay redirects the configured `?simLinkCode=` links to the offer checkout (`?oferta=`, button "Assinar"), which also prefills `name`, `email`, `document` and `phone` from the query. Pix renews by paying a new Pix each cycle; card is charged automatically. Every paid cycle is a new transaction, so it arrives as an ordinary `purchase_approved` with a new `orderId` (plus `pix_generated` before it for Pix). Offer sales also carry `offerId` and `chargeId`; items keep the same shape (`tipo`, `titulo`, `valor`).
- `subscription_activated` (offer outbox): sent with the first paid cycle and when a suspended contract is reactivated, beside that payment's `purchase_approved`. Signed like the sales events, but with another body (amounts in reais and cents, `contractId`, `planName`).

## Backend behavior

- **Abuse limits** (`backend/src/http/`): the webhook accepts 120 requests/min per IP, checked before the signature, so a flood never computes HMACs (a 429 is retried by SimIntPay). The privacy form (`/privacy/requests` and `/confirm`) accepts 5 per 10 min per IP. The IP is the LAST `X-Forwarded-For` entry, set by our Caddy; `X-Real-IP` is ignored because the backend proxy does not overwrite it (a forged value per request used to bypass the limit). Limits live in memory: one instance, reset on restart.
- `purchase_approved` activates the plan chosen at sign-up, or extends it by one year. Idempotent by `orderId`, also for simultaneous notifications: the activation is one conditional `UPDATE` (only while the user does not have that `orderId` yet), so a second approval of the same order updates no row and sends no second e-mail. The same transaction records the `eventId` in `ProcessedEvent`, and a notice dated before the last processed payment is ignored: a late redelivery of an older order (already replaced by a renewal) cannot extend the plan again. The first payment emails a link to create the password (`/esqueci-senha?email=`, the normal reset-code flow); a password is never sent by e-mail. An account without a password gets a reset code only if it has paid at least once (`simpayOrderId`): that covers the new buyer and also one who expired or was refunded before creating the password, who would otherwise be locked out (the sign-up form tells an existing customer to log in, and only a logged-in owner can renew). An account that never paid gets no code.
- `subscription_activated` is acknowledged with 200 and nothing else: no change to the user (the same payment's `purchase_approved` activates or extends) and no relay to the track, which does not know it. Without the 200, SimIntPay would retry it forever (up to once an hour). Any other unknown event still gets 400, so a new kind of notice is noticed instead of silently dropped.
- Sign-up `tracking.consent` (`granted`/`rejected`) carries the banner choice. `rejected` replaces the saved tracking entirely; the relay merges it with the checkout keys, and the track never sends that sale to Meta/GA4 (see business-rules).
- The sign-up form is public and an e-mail proves nothing, so an account that already paid (it has a password or an order) is changed only by its logged-in owner (Bearer token): without login nothing is touched and the answer is `{ loginRequired: true }`. The owner with an ACTIVE plan keeps access: the profile is updated and a different plan is stored in `pendingPlan`, which becomes the plan only when the next `purchase_approved` arrives. An account that never paid is changed only by the browser that made the sign-up: the answer carries a `registrationToken` (stored as SHA-256 in `registrationTokenHash`, kept in the browser's `localStorage`) that a re-submit must send to fix data or change plan. Without it nothing is stored and the checkout link is built from the submitted data, never from the account's. The answer never carries the user id or account data; a changed phone clears `phoneVerified`.
- `purchase_refunded` and `chargeback` set the user whose last paid order is that `orderId` to `EXPIRED`. A refund of an older order, already replaced by a newer paid one, does not revoke.
- Every valid event is then relayed to the track (`backend/src/track/track-relay.service.ts`):
    - unchanged, with the same `eventId`, signed with `TRACK_WEBHOOK_SECRET` and posted to `TRACK_WEBHOOK_URL` (`https://track.rastrewin.com/api/webhook/compra`);
    - `tracking`: the checkout's own keys win; the tracking saved at sign-up (`User.tracking`: `src` = `trck_user_id`, `utm_*`, `fbc`, `fbp`, `aff`) fills the rest. The checkout keys come from the checkout URL: the frontend appends the same tracking to it (`withTracking` in `frontend/lib/track.ts`), and SimIntPay accepts `src`, `utm_*`, `fbclid`, `fbc`, `fbp` and `aff` (affiliate code, from the necessary cookie `_trck_aff`) in the query. The backend also adds `aff` from `User.tracking` to the prefilled checkout link (`checkoutUrlWithPrefill`). `aff` is validated (`^[A-Za-z0-9_-]{3,40}$`) and dropped silently otherwise. The saved copy only covers a buyer whose checkout lost the query, and it is found by e-mail;
    - affiliate: when the sale has one, SimIntPay's event carries `affiliate: { code, commissionCents, name? }` (no e-mail or third-party values). The relay passes it through unchanged and the track treats it as the source of truth; a renewal with no commission (option off) arrives without the field;
    - `renewal: true` on `purchase_approved`, `pix_generated` and `card_declined` when the buyer already had a paid order (never on post-purchase events, so refunding an old order does not turn it into a renewal). A notice of an order older than the last payment (a late redelivery) carries no `renewal` field: only the latest order is stored, so the backend cannot tell whether that order was the first purchase. The track also freezes the flag once a sale is approved, so a redelivery never moves the first purchase out of the acquisition metrics. The track stores it but does not send it to Meta/GA4 (neither `Purchase` nor `AddPaymentInfo`);
    - `plan` (`basico`, `pro` or `vip`) on those same events, from the sign-up (`pendingPlan ?? plan`). The track uses it as the id of the sale's main item for Meta and GA4.
- The relay never blocks the answer to SimIntPay. Each event is first stored in the backend table `TrackRelay` and removed only when the track answers 2xx. A worker retries due rows every minute with backoff (1 min up to 6 h, 20 attempts, about 3 days; the Meta CAPI accepts sales up to 7 days old). 401/503 from the track (secret changed or not generated yet) are retried; other 4xx stop the retries and keep the row with `lastError`. The track deduplicates by `eventId`, so a resend never duplicates a sale. Logs carry no personal data. Without both `TRACK_WEBHOOK_*` variables the relay is off.
- **Heartbeat:** every minute, after draining the queue, the backend posts the queue state to the track (`POST /api/webhook/relay-status`, same signature): pending count, oldest pending, and the rows it gave up on (event ID, attempts, technical error only). The track shows it in Configurações › Saúde and warns when a sale waits more than 30 min, when the backend gave up on one, or when no heartbeat arrives for 10 min. If someone clicks "Tentar de novo" there, the response carries `retry_failed: true` and the backend puts the given-up rows back in the queue.

- **Privacy requests (LGPD)** use the same signature and secret to call the track (`backend/src/privacy/track-privacy.client.ts` → `/api/privacy/export` and `/api/privacy/erase`, host taken from `TRACK_WEBHOOK_URL`). Erasure also deletes given-up `TrackRelay` rows whose body contains the e-mail; pending ones are still delivered and reach the track already anonymized (30-day tombstone).

## Environment (backend)

`SIMPAY_WEBHOOK_SECRET`, `SIMPAY_INBOUND_TOKEN`, `TRACK_WEBHOOK_URL`, `TRACK_WEBHOOK_SECRET`. See `.env.example`. The track secret is generated in track › Configurações › Webhook de vendas.

## Local test

Sign the body the same way SimIntPay does:

```bash
body='{"eventId":"evt_local_0001","occurredAt":"2026-11-05T12:00:00.000Z","event":"purchase_approved","orderId":"tx_local_1","amountCents":50000,"customerEmail":"voce@example.com"}'
sig=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$SIMPAY_WEBHOOK_SECRET" -hex | awk '{print $NF}')
curl -X POST localhost:3011/payments/webhook -H 'content-type: application/json' -H "x-simintpay-signature: $sig" --data-binary "$body"
```

Never point a local test at production databases or at the real track.
