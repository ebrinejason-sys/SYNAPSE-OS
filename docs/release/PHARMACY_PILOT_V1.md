# SYNAPSE Pharm — Pilot-Ready v1

**Executive status: YELLOW** (implementation in progress on `cursor/pharmacy-pilot-v1-9386`)

Last updated: 2026-08-10. Honest demonstrated capability only — no optimistic percentages.

---

## 0. Ground truth (Phase 0 audit)

### Environment limits for this agent run
- Repo Supabase URL is `placeholder-project.supabase.co` — **live DB cannot be queried or migrated from this cloud agent**.
- Supabase MCP: `needsAuth` (unauthenticated).
- Prior live read-only recheck (2026-08-07, recorded in `implementation-status.md`) remains the last known live schema signal.

### Already working (code + tests; live apply separate)
- POS sell path via `complete_pharmacy_sale` (portal + mobile) with FEFO allocation over active batches.
- Shared inventory domain (`@synapse/db/inventory`): sellable/physical/expired/quarantined/damaged/unbatched, FEFO allocate, structured stock errors.
- Shared import validation (`@synapse/db/import-validation`).
- Shared immutable receipt domain (`@synapse/db/receipt`) + mobile receipt APIs + native receipt screen (print/share/email/reprint).
- Native CSV/XLSX import UI (document picker); portal Excel redirect removed from stock-import.
- Pharmacy portal auth, tenant gating, capability lattice, subscription degrade.
- Portal inventory catalogue UI, transactions list, reports API, settings/users foundations.

### Partially working / in progress this branch
- Inventory authority migrations in repo (`20260805130000` + `20260810120000`) — **not applied live** in this environment.
- Write paths converging on `receive_pharmacy_stock` / `adjust_pharmacy_batch_stock` / `reverse_pharmacy_sale`.
- Portal API camelCase serialization for suppliers/POs/customers/orders/refunds.
- Dashboard staff access + real pending-orders count.
- Native pharmacy: POS, sales, stock, receipts exist; reports/refunds/suppliers/users/settings still portal redirects.

### Broken / high-severity (pre-fix baseline)
- Live inventory-authority migration absent (2026-08-07).
- `complete_pharmacy_sale` SECURITY DEFINER executable by `authenticated` (hardening migration revokes; needs live apply).
- Legacy unbatched positive product quantities require reconciliation, not fabricated batches.

### Blocked by infrastructure
| Blocker | Impact |
|---------|--------|
| Placeholder Supabase credentials | Cannot apply migrations, seed pilot tenant, or run live smoke |
| Supabase MCP unauthenticated | Cannot introspect live schema/grants from MCP |
| EAS credentials unknown until build | APK may be build-ready but not produced remotely |

### Database / migration status
| Migration | Repo | Live (2026-08-07) | This agent |
|-----------|------|-------------------|------------|
| `20260730120000_pos_sale_idempotency_in_rpc.sql` | present | applied | not re-verified |
| `20260805130000_pharmacy_inventory_authority.sql` | present | **NOT applied** | not applied |
| `20260810120000_pharmacy_pilot_authority_hardening.sql` | **added** | not applied | not applied |

### Tests / builds
Recorded in sections below after verification.

---

## 1. Features completed this branch (rolling)

- Shared `@synapse/db/inventory-rpc` (`receivePharmacyStock`, `adjustPharmacyBatchStock`, `reversePharmacySale`, pharmacy-language error parse).
- Portal stock adjust → RPC authority (INCREASE requires batch+expiry).
- Portal `/api/admin/inventory/receive`.
- PO RECEIVED requires per-line batch/expiry via `receive_pharmacy_stock`.
- Portal + mobile bulk import → validate → qty 0 catalogue → receive RPC for valid batches.
- Mobile inventory create/correct → batch-aware; bare qty correction rejected.
- Portal + mobile refunds → `reversePharmacySale` (default restore quarantined).
- Portal admin API camelCase serializers for suppliers/POs/customers/orders/refunds.
- Dashboard: staff can load; pendingOrders from real open POs + pending orders.
- Security hardening migration: revoke EXECUTE of privileged RPCs from anon/authenticated; grant service_role; adjust/reverse RPCs; extended receive.

## 2–16. Status sections

Filled as verification completes — see bottom of file after tests/builds/smoke.
