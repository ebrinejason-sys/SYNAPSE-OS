# Synapse OS complete work plan

> **Historical delivery plan.** This plan is useful implementation evidence but its pharmacy-first sequence does not define the current ecosystem strategy. The balanced three-product roadmap that now governs Synapse OS, Synapse Pharm, Synapse App, and shared Core is [../../SYNAPSE_ECOSYSTEM_OPERATING_MODEL_2026.md](../../SYNAPSE_ECOSYSTEM_OPERATING_MODEL_2026.md#21-outcome-led-delivery-roadmap).

**Status:** Active delivery doctrine  
**Adopted:** 2026-07-25  
**Principle:** Finish each stage against measurable acceptance criteria before opening another large workstream.

## Delivery sequence

1. Improve landing-page typography and visual consistency.
2. Bring pharmacy to production-grade completeness.
3. Build reliable platform-admin monitoring around pharmacy.
4. Harden and finish the Expo app.
5. Complete Hospital OS one clinical workflow at a time.
6. Integrate, pilot, secure, and scale the full ecosystem.

---

## Phase 0 — Establish the delivery baseline

**Duration:** 2–3 days

### Work

- Install dependencies and run every existing check.
- Repair the web lint script for the current Next.js version.
- Run web / pharmacy / Expo checks and migration integrity.
- Record production URLs, env vars, deployments, migration state.
- Document major user roles.
- Protect uncommitted work via intentional commits or branches.
- Create a staging environment.

### Completion gate

No unexplained build failures, and the current production state is reproducible.

Baseline report: [2026-07-25-phase0-baseline.md](../reports/2026-07-25-phase0-baseline.md)

---

## Phase 1 — Landing-page typography and visual system

**Duration:** 1–2 weeks

### Fonts

| Family | Use |
|---|---|
| Bricolage Grotesque | Marketing display headings, major titles, high-impact numbers |
| DM Sans | Body, nav, buttons, forms, product UI |
| IBM Plex Mono | IDs, metadata, receipts, aligned prices/measurements — never long paragraphs |

### Semantic styles

Display XL/L · Heading 1–4 · Lead · Body large/regular/small · Label · Caption · Overline · Mono value

### Components to build

`Eyebrow` · `DisplayHeading` · `SectionHeading` · `LeadText` · `BodyText` · `MetricValue` · `TextLink`

### Completion gate

Every landing page uses the approved type system, remains readable on small Android devices, and passes visual/accessibility review.

Draft spec: [2026-07-25-typography-system.md](../specs/2026-07-25-typography-system.md)

---

## Phase 2 — Perfect the pharmacy system

**Duration:** ~6–8 weeks

Release boundary: tenant onboarding, staff/roles, products/packages, batch inventory/expiry, suppliers, PO/receiving, POS, cash reconciliation, customers/credit, prescriptions/refills, refunds, reports, subscription billing, audit, notifications, platform oversight.

Highest-urgency: unify POS on `complete_pharmacy_sale`, retire legacy transaction route, idempotency, capability-based roles, stock/cash ledgers, till controls, prescription safety, purchasing lifecycle, reports, pilot.

POS inventory: [2026-07-25-pharmacy-pos-sale-path-inventory.md](../reports/2026-07-25-pharmacy-pos-sale-path-inventory.md)  
Capability matrix draft: [2026-07-25-pharmacy-capability-matrix.md](../specs/2026-07-25-pharmacy-capability-matrix.md)

### Completion gate

A pharmacy can operate daily without spreadsheets for scoped workflows; money and stock reconcile; two-week pilot shows no critical integrity problems; recovery procedures documented.

---

## Phase 3 — Admin dashboard for pharmacy operations

**Duration:** 2–3 weeks (overlap pharmacy pilot)

Replace simulated monitoring. Structure: executive overview, operational health, tenant health, risk/security. Alerts with severity, ownership, acknowledgment, resolution.

### Completion gate

Platform admin can detect, investigate, and act on pharmacy business/ops/billing/security problems without manual DB queries.

---

## Phase 4 — Expo application hardening

**Duration:** 3–5 weeks

Security (cache isolation, logout clear, PHI TTLs, biometric fallback, session revocation), reliability (offline/stale states, retries, telemetry), product experience by audience, automated Android smoke tests.

### Completion gate

Mobile passes security review; critical Android flows automated; no PHI persists across user sessions.

---

## Phase 5 — Hospital OS vertical workflows

**Duration:** 3–6 months, incremental

| Release | Scope |
|---|---|
| 5A | Registration and OPD |
| 5B | Laboratory and radiology |
| 5C | Hospital dispensing |
| 5D | IPD and nursing |
| 5E | Revenue cycle |
| 5F | Specialist modules (after core stable) |

Do not expand horizontally. Finish vertical paths with APIs, validation, permissions, audit, notifications, empty/error states, and e2e tests.

---

## Phase 6 — Unified platform operations

Ongoing: cross-product tenant health, clinical-safety monitoring, pharmacy exceptions, mobile crash/notification monitoring, revenue ops, support cases, deployment/migration ledger, compliance, shared event model.

---

## Milestones

| Milestone | Target outcome |
|---|---|
| M1 | Typography system approved; landing pages migrated |
| M2 | Pharmacy money/stock paths atomic and tested |
| M3 | Pharmacy roles, shifts, inventory, prescriptions complete |
| M4 | Pharmacy reports, reconciliation, and pilot complete |
| M5 | Admin dashboard provides real pharmacy monitoring |
| M6 | Expo secured and release-tested |
| M7 | Hospital registration and OPD production-ready |
| M8 | Lab, radiology, and hospital dispensing complete |
| M9 | IPD, nursing, billing, and claims complete |
| M10 | Unified ecosystem monitoring and broader rollout |

---

## Immediate next sprint (two weeks)

1. Green baseline builds.
2. Typography specification.
3. Migrate homepage + one pharmacy landing page as references.
4. Correct character-encoding problems.
5. Mobile and desktop visual checks.
6. Inventory every frontend caller of both pharmacy sale endpoints.
7. Design single atomic POS contract and its tests.
8. Define pharmacy capability matrix.
9. Prepare pharmacy staging + realistic seed data.

**Do not begin new Hospital OS modules during this sprint.**
