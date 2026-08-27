# SYNAPSE Weekend Platform Audit — 2026-08-27

**Repository:** `ebrinejason-sys/SYNAPSE-OS`  
**Method:** Code, migrations, generated types, routes, and docs. A page, table, or marketing sentence is not treated as a working feature.  
**Blueprints consulted:** `docs/SYNAPSE_MASTER_BLUEPRINT_2026.md`, `docs/SYNAPSE_ECOSYSTEM_OPERATING_MODEL_2026.md` (architectural evidence, not production truth).

## Classification key

| Label | Meaning |
|---|---|
| OPERATIONAL | Implemented, tested, and safe to run in a constrained live setting |
| PARTIAL | Meaningful behaviour; journey incomplete |
| PROTOTYPE | Demonstrates an idea |
| MOCK | Returns success or static data without a domain write |
| PLACEHOLDER | Coming soon / empty route |
| ROADMAP | Designed, not implemented |
| DEPRECATED | Should not be extended |
| DANGEROUS / STOP-SHIP | Can cause clinical, financial, or privacy harm |

## Products

| Surface | Class | Evidence |
|---|---|---|
| Synapse Pharm (`apps/pharmacy`) | PARTIAL / operational candidate | POS, FEFO, inventory RPCs, receipts, staff, billing. Live isolation proof still required. |
| Synapse OS (`apps/web` hospital) | PARTIAL | Registration + OPD triage/queue work. Most `/doctor`, `/consults`, `/nurse`, department routes are PLACEHOLDER. |
| Synapse App (`apps/app`) | PARTIAL | Role-aware reads, limited mutations. Offline is a cache, not a local authority. |
| Public site `synapseos.tech` | PARTIAL | Strong visual identity. Hero counters could render `0+` when `AnimatedCounter` never entered view; several FeatureTabs claims overstated readiness. |
| Admin `admin.synapseos.tech` | PARTIAL | MFA-gated platform admin. Tenant/pharmacy ops exist. Observability often env-var presence, not probes. |

## Shared platform

| Capability | Class | Notes |
|---|---|---|
| Identity / SYNAPSE ID / MPI scoring | PARTIAL | `packages/db` identity + MPI. `shouldAutoMerge` is always false. Hospital register is not fully wired to `persons`. |
| Timeline | PARTIAL | Primitive + pharmacy dispense publisher. Not a complete longitudinal UI. |
| Synapse Exchange | ROADMAP → DEVELOPMENT this milestone | No general clinical outbox existed. Offline mutation outbox is pharmacy sync, not the domain bus. |
| Synapse Lab | PLACEHOLDER UI + PROTOTYPE schema | `lab_orders` / `lab_results` / `lab_specimens` exist. All `/lab/*` pages were Coming soon. Instrument ingest is MOCK. |
| Pathways | PROTOTYPE schema + PLACEHOLDER UI | `clinical_pathway_templates` / `patient_pathways` in types. No runtime. |
| FHIR | MOCK / PLACEHOLDER | CapabilityStatement advertises resources; handlers 501. |
| DHIS2 | PLACEHOLDER | Inserts a pending row. |
| Imaging / DICOM | ROADMAP | Schema/marketing only. |
| Intelligence / AI | PROTOTYPE | Advisory only; not safe to release labs or dispense. |
| Edge / offline | ROADMAP (web POS DISABLED) | `saveOfflineTransaction` throws. POS refuses offline sales. Mobile single-counter outbox is PARTIAL. |

## Pharmacy stop-ship review (current tree)

| Item | Class now |
|---|---|
| Offline POS loss-of-sale | Mitigated in code: offline helpers throw; POS shows downtime copy. Still DANGEROUS if re-enabled without durable storage. |
| `SECURITY DEFINER` RPCs | Still a live-DB review item. Not re-litigated here; do not add new definer shortcuts. |
| Client-trusted prices | POS validation exists; remain server-authoritative. |

## Database

Checked-in migrations: 33+ files through `20260823120000`, plus this milestone's exchange/lab/simulation migration. `packages/db/src/types.ts` lags `persons`, `lab_specimens`, `lab_orders`. Treat SQL as source of truth until types are regenerated.

## What this milestone must not duplicate

- `patients` / `persons` / `person_identifiers`
- `lab_orders` / `lab_results` / `lab_specimens`
- `clinical_pathway_templates` / `patient_pathways`
- Pharmacy POS / inventory / `complete_pharmacy_sale`
- Custom session + TOTP MFA for platform admin

## Honest public counters

Previous hero metrics (`20+` modules, `150+` scores, `120+` RLS tables) were hardcoded animations. If `useInView` never fired, they displayed `0+`. They are replaced with capability statements from `packages/config/src/product-manifest.ts`.
