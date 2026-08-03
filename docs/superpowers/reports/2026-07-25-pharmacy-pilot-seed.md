# Pharmacy pilot seed — runbook

**Date:** 2026-07-25  
**Tenant:** `pharm-synapse-pilot` / Synapse Pilot Pharmacy  
**Project:** SYNAPSE_OS (`qfqakzmjatszisuqjwon`)

Dedicated staging tenant only. Does **not** touch CARE PLUS, Doctor’s, or 3brine.

## Already seeded on SYNAPSE_OS

| Entity | Count |
|---|---|
| Store | 1 (Main Branch) |
| Staff | 5 |
| Products | 10 |
| Batches | 15 (FEFO fixtures) |
| Suppliers | 2 (JMS, NMS) |
| Customers | 3 |
| Discount threshold | 5% |

### Staff logins

Password for all: `PilotDemo2026!`

| Email | Capability role |
|---|---|
| `pilot.admin@synapseos.tech` | pharmacy_admin |
| `pilot.cashier@synapseos.tech` | pharmacy_cashier |
| `pilot.pharmacist@synapseos.tech` | pharmacist |
| `pilot.inventory@synapseos.tech` | inventory_officer |
| `pilot.manager@synapseos.tech` | pharmacy_store_manager |

Login: pharmacy app `/login` (e.g. https://pharm.synapseos.tech/login).

### Dry-run scenarios

1. POS sell as cashier  
2. FEFO: Paracetamol picks `PARA-SOON` before `PARA-OK`; skips expired `PARA-EXP`  
3. Discount &gt;5% needs manager or admin  
4. Inventory adjust as inventory officer; cashier should 403  
5. Ibuprofen near reorder for low-stock alerts  

## Schema prerequisite

Migration `20260725130000_pharmacy_capability_roles.sql` widens  
`pharmacy_user_settings.pharmacy_role` to include capability roles  
(`pharmacy_cashier`, `pharmacist`, `inventory_officer`, `pharmacy_store_manager`, `finance`)  
while keeping legacy `pharmacy_ceo` / `pharmacy_admin` / `pharmacy_staff`.

`profiles.role` stays on the constrained set (`pharmacy_admin`, `pharmacy_staff`, `pharmacist`, …).  
The seed maps:

- cashier / inventory / manager → `profiles.role = pharmacy_staff`  
- capability role → `pharmacy_user_settings.pharmacy_role`

## Re-run locally / CLI

Requires `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) + `SUPABASE_SERVICE_ROLE_KEY` in  
`apps/pharmacy/.env.local` or `apps/web/.env.local`.

```bash
npm run seed:pharmacy-pilot
npm run seed:pharmacy-pilot:reset   # wipe pilot products/batches then reseed catalog
```

Script: `scripts/pharmacy-pilot-seed.mjs`  
- Finds tenant by slug `pharm-synapse-pilot` (creates only if missing)  
- Upserts staff with correct profile vs pharmacy role split  
- Seeds suppliers, customers, catalog with FEFO batches  
- Consumables without real expiry use `2099-12-31` (`pharmacy_product_batches.expiry_date` is NOT NULL)

## Safety

- Only operate on slug `pharm-synapse-pilot`  
- Never point `--reset-inventory` at a live pharmacy tenant  
- Rotate `PilotDemo2026!` before any production-like exposure  
