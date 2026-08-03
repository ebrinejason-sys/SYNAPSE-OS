# Pharmacy capability matrix (draft) — 2026-07-25

## Current state

- Roles exist in config: `pharmacy_admin`, `pharmacist`, `pharmacy_cashier`, `pharmacy_store_manager` (`packages/config/src/constants.ts`).
- Runtime also uses `pharmacy_ceo`, `pharmacy_staff`, and free-form `permissions[]` on `pharmacy_user_settings`.
- `hasPharmacyPermission` in `apps/pharmacy/lib/auth.ts` grants admins everything; otherwise checks `permissions` array.
- **`requirePharmacyPermission` in `api-auth.ts` ignores the permission argument and always requires admin** — API surface is effectively admin-only for “permission” gates.

## Target roles

| Role | Key capabilities |
|---|---|
| Cashier | `pos.sell`, `pos.suspend`, `pos.resume`, `shift.view_own` |
| Pharmacist | `rx.verify`, `rx.dispense`, `rx.substitute`, `pos.sell` |
| Inventory officer | `inventory.products`, `inventory.batches`, `inventory.receive`, `inventory.adjust` |
| Store manager | `staff.schedule`, `inventory.approve`, `reports.operational`, `shift.approve_variance` |
| Finance | `payments.manage`, `credit.manage`, `refunds.manage`, `recon.manage` |
| Pharmacy owner/admin | `*` tenant ops + configuration |
| Platform support | Limited audited cross-tenant support |
| Platform superadmin | Exceptional cross-tenant administration |

## Capability catalog (initial)

| Capability | Cashier | Pharmacist | Inventory | Store mgr | Finance | Owner |
|---|---|---|---|---|---|---|
| `pos.sell` | ✓ | ✓ | | ✓ | | ✓ |
| `pos.discount_limited` | ✓ | ✓ | | ✓ | | ✓ |
| `pos.discount_override` | | | | ✓ | | ✓ |
| `pos.refund` | | | | ✓ | ✓ | ✓ |
| `shift.open_close` | ✓ | | | ✓ | | ✓ |
| `shift.approve_variance` | | | | ✓ | ✓ | ✓ |
| `inventory.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `inventory.write` | | | ✓ | ✓ | | ✓ |
| `inventory.adjust` | | | ✓* | ✓ | | ✓ |
| `purchasing.manage` | | | ✓ | ✓ | ✓ | ✓ |
| `rx.verify` | | ✓ | | ✓ | | ✓ |
| `rx.dispense` | | ✓ | | ✓ | | ✓ |
| `customers.credit` | limited | | | ✓ | ✓ | ✓ |
| `reports.operational` | own | ✓ | ✓ | ✓ | ✓ | ✓ |
| `reports.financial` | | | | ✓ | ✓ | ✓ |
| `staff.manage` | | | | ✓ | | ✓ |
| `settings.manage` | | | | | | ✓ |
| `audit.read` | | | | ✓ | ✓ | ✓ |

\* Material adjustments may require store-manager approval.

## Implementation plan

1. Define `PharmacyCapability` union + role→capability map in `@synapse/config` or `apps/pharmacy/lib/capabilities.ts`.
2. Change `requirePharmacyPermission` to evaluate real capabilities (admin/ceo still wildcard).
3. Audit every pharmacy API route + portal nav item; attach one capability (or list).
4. Seed default `permissions` for each role on invite/create.
5. Add contract tests: cashier cannot adjust stock; pharmacist can verify Rx; finance cannot sell without capability, etc.
6. Platform support/superadmin paths stay on `requirePlatformAdmin` with impersonation audit — not tenant role wildcards.

## Non-goals this sprint

- Full UI role editor redesign.
- Hospital clinical capabilities.
- Fine-grained field-level ACL.
