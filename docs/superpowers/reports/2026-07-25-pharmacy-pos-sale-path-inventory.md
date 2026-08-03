# Pharmacy POS sale-path inventory — 2026-07-25

## Endpoints

| Path | File | Status |
|---|---|---|
| `POST /api/admin/pos/complete-sale` | `apps/pharmacy/app/api/admin/pos/complete-sale/route.ts` | **Live** — calls `complete_pharmacy_sale` RPC |
| `POST /api/admin/pos/transaction` | `apps/pharmacy/app/api/admin/pos/transaction/route.ts` | **Legacy** — non-atomic multi-step updates; **no frontend callers found** |
| `POST /api/admin/pos/supervisor-approve` | `apps/pharmacy/app/api/admin/pos/supervisor-approve/route.ts` | Discount / override support |

## Frontend callers

| Caller | Endpoint | Notes |
|---|---|---|
| `apps/pharmacy/app/portal/pos/page.tsx` (~685) | `queueMutation("/api/admin/pos/complete-sale", …)` | Offline queue |
| `apps/pharmacy/app/portal/pos/page.tsx` (~726) | `fetch("/api/admin/pos/complete-sale", …)` | Online path |

No references to `/api/admin/pos/transaction` in `*.ts` / `*.tsx` across the monorepo.

## Gaps vs acceptance criteria

1. **Legacy route still deployable** — must return 410/disabled or be deleted after one release with monitoring.
2. **Client-supplied `staffId`** — both UI payload and `complete-sale` accept `body.staffId` as cashier; should always use authenticated `session.userId` unless audited supervisor delegation exists.
3. **No idempotency key** on complete-sale or offline queue retries — duplicate sales on timeout/retry remain possible.
4. **Offline optimistic UX** — stores mock transaction and clears cart before sync success; integrity risk if sync fails or double-plays.

## Proposed atomic contract (design target)

```http
POST /api/admin/pos/complete-sale
Idempotency-Key: <uuid>
Content-Type: application/json

{
  "items": [{ "productId", "quantity", "unitPrice?", "batchId?", "discountAmount?", "discountReason?", "discountApprovedBy?" }],
  "paymentMethod": "cash|mobile_money|card|credit|insurance|…",
  "amountPaid"?: number,
  "customerId"?: string,
  "creditTerms"?: object,
  "supervisorOverride"?: { "approverId", "reason", "token" }
}
```

Server rules:

- Cashier identity = session user only.
- Prices and permissions derived server-side from catalog + settings.
- Single DB transaction via versioned `complete_pharmacy_sale` (stock validate, FEFO, deduct, sale/lines/payment/credit/audit/receipt).
- Idempotency table keyed by `(tenant_id, idempotency_key)` returning the original sale on retry.
- Preferred `batchId` advisory only; FEFO enforced inside RPC.

## Test matrix (to implement)

- Concurrent last-unit sale (two cashiers)
- Timeout + retry with same idempotency key
- Failure after validation (no partial write)
- Expired / recalled batch exclusion
- Discount over cashier limit without supervisor
- Insufficient stock across batches
- Duplicate payment reference
- Credit sale ledger entry
- Offline queue replay exactly once
