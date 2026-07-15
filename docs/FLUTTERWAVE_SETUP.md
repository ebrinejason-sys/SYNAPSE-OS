# Flutterwave setup — Synapse subscription billing

## 1. Environment variables

Add to **apps/web** (production on `synapseos.tech`) and **apps/pharmacy**:

```env
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-...
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-...
FLUTTERWAVE_WEBHOOK_SECRET=your-webhook-hash
CRON_SECRET=random-long-string
NEXT_PUBLIC_APP_URL=https://synapseos.tech
NEXT_PUBLIC_PHARMACY_APP_URL=https://pharm.synapseos.tech
```

Use `FLWSECK_TEST-…` / `FLWPUBK_TEST-…` keys on preview deployments; live keys
(`FLWSECK-…`) only in production. The secret key must never be exposed to the
client bundle (`NEXT_PUBLIC_*` is forbidden for it).

## 2. Webhook configuration (Flutterwave Dashboard)

1. [Flutterwave Dashboard](https://dashboard.flutterwave.com) → **Settings → Webhooks**
2. Webhook URL: `https://synapseos.tech/api/billing/webhook/flutterwave`
3. Set **Secret hash** → copy to `FLUTTERWAVE_WEBHOOK_SECRET`
4. Enable **charge.completed**

Every `charge.completed` is re-verified server-to-server against
`GET /v3/transactions/{id}/verify` (status, currency=UGX, amount ≥ plan price,
tx_ref match) before any activation — the webhook payload alone is never trusted.
Replays are idempotent no-ops (200).

## 3. Apply migrations

Run on project `qfqakzmjatszisuqjwon`:

1. `supabase/migrations/20260620000001_subscription_billing_flutterwave.sql`
2. `supabase/migrations/20260714210000_subscription_invoices.sql` — Kampala-numbered
   subscription invoice ledger (`INV-YYYYMMDD-####`). Until applied, invoice numbers
   are stamped into `subscription_payments.raw_payload.invoice_no` as a fallback.

## 4. Cron — nightly billing sweep

Vercel runs `GET /api/cron/billing-sweep` at **21:15 UTC = 00:15 Africa/Kampala**
(see `apps/web/vercel.json`). It advances the subscription state machine
(trial/period expiry → `past_due` +5-day grace → `suspended`; never auto-cancels,
never deletes), emails tenant admins on transitions and at T−3 days before
renewal/trial expiry, purges stale `auth_otps` (>15 min) and
`password_reset_tokens` (>60 min), and records the run in
`platform_billing_config` under `billing_sweep_last_run`.

Manual test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://synapseos.tech/api/cron/billing-sweep
```
