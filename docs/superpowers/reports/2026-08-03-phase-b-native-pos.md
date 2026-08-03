# Phase B — Native pharmacy POS in Expo

**Date:** 2026-08-03  
**Scope:** In-app checkout via same `complete_pharmacy_sale` RPC as pharmacy portal.  
**Out of scope:** Supervisor discount approval UI, CREDIT ledger, packages UI (base units only), offline queue.

## Shipped

### Mobile APIs (`apps/web`)
- `GET /api/mobile/pharmacy/pos/products` — sellable catalog (price, packages, FEFO batches) + `q` search
- `POST /api/mobile/pharmacy/pos/complete-sale` — validates lines, enforces list price, idempotency, calls `complete_pharmacy_sale`
- Helpers: `lib/pharmacy-pos/sale-validation.ts`, `lib/pharmacy-pos/idempotency.ts`

### Expo (`apps/app`)
- Stack screen `/pos` — search → cart → Cash / Mobile money / Card → complete
- Sales tab: **New sale** CTA → `/pos`
- Dashboard quick action: `app:/pos` (no web POS redirect)
- Tabs unchanged (still 5); POS is a stack modal from Home/Sales

### Still web
- Billing & renewal
- Full portal POS extras (supervisor approve flow, credit customers)

## Smoke
1. Pharmacy login → Home → New Sale (POS)
2. Add line(s), pick payment, Complete → receipt banner
3. Sales history shows the new receipt
4. Retry same idempotency key does not double-charge

## Deploy
- Web READY: `dpl_A24Gnwf7otYPDGkNwyFcfJpAXgpW` → https://app.synapseos.tech
- EAS APK (Phase B): https://expo.dev/accounts/ebrinejason/projects/synapse-app/builds/c65231a1-1a85-4093-b7c2-8392ddff8ea4
- Git: no commit
