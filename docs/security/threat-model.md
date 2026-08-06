# Synapse Health OS — Threat Model

Scope: multi-tenant healthcare platform (PHI, payments, public-health data) across web + Expo,
Supabase Postgres, custom JWT auth. Grounded in audit §7.

## Assets
Patient PHI, clinical records, pharmacy financials/receipts, subscription/billing data, staff
credentials/sessions, audit logs, platform-admin capabilities, integration tokens (EFRIS, DHIS2,
NIRA, Flutterwave, messaging).

## Trust boundaries
Browser/Expo ↔ web BFF (`/api`); web BFF ↔ Supabase (service role); platform admin ↔ tenant data;
tenant ↔ tenant; app ↔ external integrations.

## Principal risks & controls
| # | Threat | Control (target) | Status |
|---|--------|------------------|--------|
| T1 | Cross-tenant read/write (IDOR) | Server-side `tenant_id` scoping on every query + RLS defence-in-depth; `assertResourceTenant`. | Partial — `GET /api/mobile/inventory` authorises any tenant user without pharmacy role (fix). |
| T2 | Missing RLS on core pharmacy tables | Confirm/enable RLS on `pharmacy_products/batches/pos_sales/*` in live DB. | **Unknown** (not in migrations) — confirm against live. |
| T3 | Privilege escalation via platform admin | Capability lattice; impersonation blocked for admin targets; support sessions time-limited, read-only default, audited. | Impersonation exists; safe support session **not built** (Phase 4). |
| T4 | PHI leakage to logs / external models | No PHI in logs; AI gateway guardrails; no external model without approved config. | Partial — remove `admin.ts` key-char debug log; AI gateway not built. |
| T5 | Phantom stock → financial/clinical error | Batch-authoritative `sellableQuantity`; structured POS errors; receiving via batch only. | **Phase 1 built** (runtime + additive migration pending apply). |
| T6 | Fiscal misrepresentation | Never label a receipt fiscal unless EFRIS accepted; mark non-fiscal otherwise. | Design (Phase 3). |
| T7 | Synthetic data reaching real integrations | Sandbox tenant flag + egress guard at every integration adapter. | Design (Phase 4). |
| T8 | Idempotency / double-sell on retry | In-RPC idempotency claim (`pharmacy_sale_idempotency`). | Built. |
| T9 | Consent violation (family/records) | Consent records + scope checks; relatives cannot browse charts; sensitive categories separated. | Design (Phase 10/12). |
| T10 | Supply-chain / dependency | Address known npm vulns; fix broken lint gate (ajv) so static analysis runs. | Lint gate broken (documented remediation). |

## Governance requirements (all phases)
Server-side tenant + role enforcement, object-ownership validation, RLS where appropriate,
service-role only in protected routes, IDOR prevention, no cross-tenant search leakage, audit of
privileged actions, encryption of sensitive values, break-glass with reason + expiry, consent
records, retention controls, data-export audit, deletion/archival workflows, no PHI in logs, rate
limiting, secure file access, signed URLs with expiry, session revocation, device/session
visibility, offline-conflict handling, backup/restore docs.

## Immediate hardening backlog (small, high-value)
1. Add pharmacy-role check to `GET /api/mobile/inventory`.
2. Remove key-char debug logging in `packages/db/src/admin.ts`.
3. Confirm + codify RLS on core pharmacy tables (needs live DB).
4. Consolidate audit writers behind `@synapse/db/audit`.
