# Phase A — Pharmacy ops in Expo (no web for daily stock/orders/sales)

**Date:** 2026-08-03  
**Scope:** Orders inbox, stock adjust, sales history read; kill web CTAs for those flows.  
**Out of scope (Phase B):** Native POS checkout (`complete_pharmacy_sale`).

## Shipped

### Mobile APIs (`apps/web`)
- `GET/PATCH /api/mobile/pharmacy/orders` — list + claim / complete / cancel (tenant-scoped; pharmacy roles)
- `GET /api/mobile/pharmacy/sales` — recent `pharmacy_pos_sales` (completed/voided)
- `PATCH /api/mobile/inventory/[id]` — set quantity + reorder level + stock adjustment row
- Shared auth: `apps/web/src/lib/mobile-pharmacy-auth.ts`

### Expo (`apps/app`)
- Tabs for pharmacy: **Home · Stock · Orders · Sales · Profile** (5 max)
- Screens: `(main)/orders.tsx`, `(main)/sales.tsx`
- Stock item: in-app **Adjust stock** (removed “Manage in web portal”)
- Stock list: removed “Manage inventory on web”
- Dashboard quick actions (server): Orders / Inventory / Sales → `app:` routes; POS + Billing remain web

### Still web (intentional)
- **New Sale (POS)** — Phase B
- **Billing & Renewal** — pharmacy portal

## Deploy
- **Web (synpase-os) READY:** `dpl_A1Ehi3B3qaAnqVjRbLgqiaw3hUeM` → https://app.synapseos.tech (mobile APIs live).
- Scoped Expo `ajv` / `@types/react` / `scheduler` overrides under `@synapse/app` only (global override broke Next typecheck).
- Expo: new EAS build queued — https://expo.dev/accounts/ebrinejason/projects/synapse-app/builds/9ee0630f-96f4-485f-8bc7-375a56795d7b
  (prior preview APK also finished: `b697047e-…` — that build is pre–Phase A UI).
- Git: no commit (per standing instruction).

## Smoke checklist
1. Pharmacy login → tabs show Orders + Sales
2. Orders: claim → complete; confirm stock moves for CUSTOMER orders
3. Stock item → Adjust stock → quantity updates + list refresh
4. Sales history lists recent POS receipts
5. Home quick actions open in-app (except POS / Billing)
