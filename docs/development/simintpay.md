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
- Subscriptions are not part of the sales API. Plan checkout links must be payment links (`?simLinkCode=`), not subscription links (`?subscriptionLinkCode=`).

## Backend behavior

- `purchase_approved` activates the plan chosen at sign-up, or extends it by one year. Idempotent by `orderId`. The first payment creates the password and emails it.
- A user with an ACTIVE plan who submits the sign-up form again keeps access: the profile is updated and a different plan is stored in `pendingPlan`, which becomes the plan only when the next `purchase_approved` arrives.
- `purchase_refunded` and `chargeback` set the user whose last paid order is that `orderId` to `EXPIRED`. A refund of an older order, already replaced by a newer paid one, does not revoke.
- Every valid event is then relayed to the track (`backend/src/track/track-relay.service.ts`):
    - unchanged, with the same `eventId`, signed with `TRACK_WEBHOOK_SECRET` and posted to `TRACK_WEBHOOK_URL` (`https://track.rastrewin.com/api/webhook/compra`);
    - `tracking`: the checkout's own keys win; the tracking saved at sign-up (`User.tracking`: `src` = `trck_user_id`, `utm_*`, `fbc`, `fbp`) fills the rest. The checkout keys come from the checkout URL: the frontend appends the same tracking to it (`withTracking` in `frontend/lib/track.ts`), and SimIntPay accepts `src`, `utm_*`, `fbclid`, `fbc` and `fbp` in the query. The saved copy only covers a buyer whose checkout lost the query, and it is found by e-mail;
    - `renewal: true` on `purchase_approved` when the buyer already had a paid order. The track stores it but does not send it to Meta/GA4.
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
