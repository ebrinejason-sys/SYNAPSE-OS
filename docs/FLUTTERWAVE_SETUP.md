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

## 2. Webhook configuration (Flutterwave Dashboard)

1. [Flutterwave Dashboard](https://dashboard.flutterwave.com) → **Settings → Webhooks**
2. Webhook URL: `https://synapseos.tech/api/billing/webhook/flutterwave`
3. Set **Secret hash** → copy to `FLUTTERWAVE_WEBHOOK_SECRET`
4. Enable **charge.completed**

## 3. Apply migration

Run `supabase/migrations/20260620000001_subscription_billing_flutterwave.sql` on project `qfqakzmjatszisuqjwon`.

## 4. Cron

Vercel runs `GET /api/cron/subscriptions` daily. Manual test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://synapseos.tech/api/cron/subscriptions
```
