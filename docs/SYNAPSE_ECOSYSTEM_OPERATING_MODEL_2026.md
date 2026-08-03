# SYNAPSE Health Ecosystem Operating Model
## Three products, one health mission, one shared platform contract

**Snapshot:** 29 July 2026  
**Repository:** `SYNPASE-OS`  
**Authority:** Product, ecosystem, outcome, ownership, and sequencing baseline  
**Scope:** Synapse OS, Synapse Pharm, Synapse App, and the shared Synapse Core/Grid  
**Audience:** Founders, product and engineering teams, clinical and pharmacy leaders, implementation teams, ministries, regulators, partners, payers, and investors  
**Status:** Proposed authoritative operating model. It supersedes the two-product definition in `SYNAPSEOS_MRD.md`, the two-product flow in `SYNAPSEOS_ECOSYSTEM_FLOW.md`, and pharmacy-first interpretations of historical delivery plans. The detailed technical audit, capability universe, and code-specific risk register remain in [SYNAPSE_MASTER_BLUEPRINT_2026.md](./SYNAPSE_MASTER_BLUEPRINT_2026.md).

> This is a product, architecture, health-system, clinical-safety, and regulatory-readiness design. It is not medical or legal advice. Country law, clinical content, national integrations, and programme indicators require written confirmation from the relevant authorities and qualified professionals.

---

## 1. The answer in plain language

SYNAPSE is an ecosystem of three product experiences:

1. **Synapse OS** — the facility and care-delivery operating system.
2. **Synapse Pharm** — the medicines-access, dispensing, retail, inventory, and supply-network operating system.
3. **Synapse App** — the person, caregiver, community, and mobile-workforce access channel.

They should be powered by a shared **Synapse Core/Grid** containing identity, organization and facility registries, master patient identity, consent, terminology, policy, audit, offline synchronization, events, interoperability, communications, indicators, country configuration, and governed intelligence. Core is infrastructure, not a fourth customer-facing product.

The repository proves that the three applications exist and can be deployed separately. It does **not** prove that all three are production-grade SaaS, offline-first, or safely interconnected:

| Question | Current truth | Required truth |
|---|---|---|
| Are there three products? | Yes. `apps/web`, `apps/pharmacy`, and `apps/app` exist. | Preserve three clear product charters and release trains. |
| Are all three SaaS products? | OS and Pharm have B2B SaaS concepts. App is a network client, not conventional per-seat SaaS. | OS and Pharm are B2B SaaS; App is B2B2C/person-centred access funded by facilities, programmes, payers, or partners. |
| Are all three offline-first? | No. OS is online-first; Pharm has a dangerous simulated-offline path; App has a limited read cache. | Each approved offline workflow has encrypted local authority, a durable outbox, idempotent server inbox, change feed, conflict rules, checkpoints, and recovery tests. |
| Are they interconnected? | Weakly. They share Supabase tables and some APIs/push notifications. | They exchange versioned commands, events, and authorized projections through owned domain contracts. |
| Do they complete a common health journey? | Not yet. Most care-delivery routes are placeholders and pharmacy-to-clinical-to-person loops are incomplete. | Every flagship release must cross OS, Pharm, and App and close a measurable care loop. |
| Can this scale across Africa? | Not safely in its current shared-database, Uganda-hardcoded form. | A universal core plus certified country packs, federated data planes, and governed regional exchange. |

The strategic correction is:

> Do not build three silos and do not build one giant application. Build three independently useful products that become more valuable when they complete the same health journey through a governed shared platform.

### 1.1 The first ecosystem proof

The first production release should prove this full journey:

```text
Synapse App appointment/community request
  -> Core identity, consent, and routing
  -> Synapse OS registration, triage, encounter, and orders
  -> Synapse Pharm availability, verification, dispense, stock, and payment
  -> Synapse App instructions, result/medicine acknowledgement, and follow-up
  -> Core routine-health, quality, and outcome projections
```

That single slice must prove:

- one person identity decision;
- one active organization/facility context;
- consent and lawful-purpose enforcement;
- signed clinical documentation;
- prescription and dispense reconciliation;
- stock and money integrity;
- durable offline recovery;
- audit and provenance;
- notification delivery;
- public-health/reporting lineage;
- cross-product traceability with one correlation ID;
- measurable patient and service outcomes.

If that slice is not dependable, adding more specialty pages makes the ecosystem look larger while making the system less trustworthy.

---

## 2. Ecosystem purpose and boundaries

### 2.1 Purpose

> Help every person receive the right preventive or clinical action, from the right part of the health system, at the right time, with continuity across household, community, facility, laboratory, pharmacy, payer, and public health — including during connectivity loss.

This purpose follows the direction of:

- [WHO primary health care](https://www.who.int/health-topics/primary-health-care): integrated life-course services, multisectoral action, and empowered people and communities;
- [WHO SMART Guidelines](https://www.who.int/teams/digital-health-and-innovation/smart-guidelines/): software-neutral, standards-based, localizable digital health content;
- [WHO routine health information systems strategy](https://www.who.int/publications/i/item/9789240087163): integrated, interoperable, evidence-informed routine information;
- [WHO digital implementation investment guidance](https://www.who.int/publications/i/item/9789240010567): needs-led investment and national architecture rather than disconnected applications;
- the [WHO Digital Health Platform Handbook](https://www.who.int/publications/i/item/9789240013728): reusable shared infrastructure beneath point-of-service applications;
- the [Uganda National Health Compact 2025–2030](https://library.health.go.ug/monitoring-and-evaluation/strategic-plan/uganda-national-health-compact-2025-2030);
- [EAC Digital REACH](https://repository.eac.int/items/a18fd376-78d2-4f6b-ba12-b3cf6f85fab5) and the EAC direction toward health data governance and health enterprise architecture;
- the [Africa CDC Digital Transformation Strategy](https://africacdc.org/download/digital-transformation-strategy/) and [African Union HIE Guidelines and Standards](https://africacdc.org/download/african-union-health-information-exchange-guidelines-and-standards/).

### 2.2 What SYNAPSE can and cannot solve

SYNAPSE can reduce failures of information, coordination, continuity, workflow, medicine visibility, financial administration, reporting, and accountability. It can support people and health workers in completing safer actions.

It cannot by itself:

- recruit, retain, or fairly pay health workers;
- build, electrify, or equip facilities;
- manufacture quality medicines or guarantee supply;
- create transport networks;
- enact insurance, privacy, professional, or telemedicine law;
- remove poverty, gender inequality, or geographic barriers;
- provide clean water, sanitation, food, or housing;
- replace qualified clinical judgement, trusted community relationships, public leadership, or emergency services;
- guarantee reduced mortality merely because software was installed.

Accountability must therefore be separated into four levels:

| Level | Examples | SYNAPSE accountability |
|---|---|---|
| Product outputs | uptime, durable offline commands, complete records, delivery receipts | Direct |
| Workflow outcomes | closed referrals, acknowledged critical results, completed dispenses | Direct or strongly shared |
| Service outcomes | immunization completion, tracer availability, controlled hypertension | Joint with health-system operators |
| Population impact | mortality, UHC coverage, catastrophic expenditure | Contributing factor, never sole attribution |

### 2.3 Eight ecosystem outcome goals

| Goal | What must improve | Shared measures |
|---|---|---|
| 1. Access and continuity | People move through community, facility, pharmacy, diagnostics, and referral without restarting their story. | prior-summary availability, duplicate rate, referral closure, follow-up completion |
| 2. Quality and safety | Required safety actions are completed and exceptions are visible. | documentation completeness, allergy/interaction checks, critical-result acknowledgement, adverse-event closure |
| 3. Medicines access | Valid medicine demand is fulfilled safely, affordably, and traceably. | fill rate, tracer availability, stock-out days, inventory accuracy, wastage, recall containment |
| 4. Financial protection | People understand costs, receive eligible coverage, and do not face fragmented bills. | estimate variance, first-pass claims, reconciliation, foregone-care reports, episode-level out-of-pocket cost |
| 5. Priority health outcomes | Maternal/newborn, child, HIV, TB, malaria, NCD, mental health, nutrition, and injury pathways close. | programme-specific due-action and care-continuity measures |
| 6. Workforce effectiveness | Scarce staff spend more time on appropriate care and less on duplicate entry. | wait/cycle time, documentation time, task completion, staff usability and burnout indicators |
| 7. Public-health intelligence and resilience | Routine care generates timely, reproducible reporting and verified response signals. | reporting concordance/timeliness, event-to-notification time, emergency continuity |
| 8. Equity, trust, and sovereignty | Service does not depend on a smartphone, literacy, stable connectivity, wealth, or remaining in one place. | completion by geography/vulnerability, accessible-channel success, privacy incidents, country control of policy/data |

---

## 3. The four charters

### 3.1 Synapse OS charter

**Mission:** Make every facility care episode safe, coordinated, efficient, complete, and ready for continuity beyond the facility.

**Primary users:** reception and health-information teams, clinicians, nurses, midwives, laboratory and imaging staff, pharmacists, rehabilitation and allied health professionals, finance/claims teams, facility managers, quality teams, biomedical/facility operations, and authorized public-health staff.

**System of record for:**

- facility registration and care episodes;
- clinical notes, diagnoses, problems, plans, procedures, and outcomes;
- triage, observations, orders, results, and acknowledgements;
- admissions, transfers, discharges, beds, theatre, and nursing care;
- facility referrals and clinical handoffs;
- clinical charges, invoices, claim evidence, and service receipts;
- facility rosters, assets, service readiness, and operational work;
- source events for routine reporting and quality measurement.

**It must not own:**

- a standalone pharmacy’s retail stock and commercial ledger;
- the patient’s communication preferences or person-supplied data as if clinically validated;
- the global identity/consent/policy engine;
- national policy hardcoded inside facility pages;
- another facility’s record without a lawful exchange and access decision.

**North-star measure:**

> Percentage of eligible care episodes completed with required documentation, orders/results reconciled, and the next action closed or safely handed over.

**Commercial form:** B2B SaaS for facilities, facility groups, districts, programmes, and dedicated/sovereign deployments.

**Offline form:** Facility LAN edge for hospitals and busy clinics; encrypted single-device mode only for bounded low-volume workflows.

**First production boundary:** Registration -> OPD triage -> signed encounter -> orders/results -> e-prescription -> bill/payment -> follow-up/referral.

### 3.2 Synapse Pharm charter

**Mission:** Make safe, quality-assured medicines continuously available, affordable, and traceable from source to patient.

**Primary users:** standalone pharmacies, hospital pharmacies, pharmacy chains, wholesalers/distributors, pharmacists, dispensers, inventory teams, cashiers, procurement, finance, owners/managers, and authorized regulators or supply partners.

**System of record for:**

- medicine/product and package master within approved catalogues;
- procurement, purchase orders, receiving, suppliers, distribution, and returns;
- batches, expiry, quarantine, recalls, storage, and stock movements;
- pharmacist verification, dispense, partial fill, substitution, and interventions;
- retail POS, till sessions, payments, receipts, refunds, credit, and reconciliation;
- replenishment, demand, shortages, network availability, and wastage;
- pharmaceutical traceability, controlled registers, and pharmacovigilance events.

**It must not own:**

- the complete clinical record;
- the diagnosis or clinical order authoring process;
- consent, MPI, or patient identity matching;
- a hospital encounter merely because a medicine was dispensed;
- an unvalidated AI verdict about medication safety.

**North-star measure:**

> Percentage of valid medicine demand fulfilled completely, safely, affordably, and traceably at the promised time.

**Commercial form:** B2B SaaS by site, branch, chain, or network with dedicated deployment options.

**Offline form:** Encrypted transactional store for one counter; pharmacy/facility LAN authority for multiple counters and shared stock.

**First production boundary:** Procurement/batch receipt -> FEFO stock -> e-prescription or approved OTC sale -> payment/receipt -> stock and cash ledger -> reconciliation -> refill/adverse-event follow-up.

### 3.3 Synapse App charter

**Mission:** Give people, caregivers, communities, and mobile workers a trusted way to prevent illness, navigate care, and complete the next appropriate health action.

**Primary users:** patients, caregivers/guardians, VHTs/CHWs, field teams, mobile clinicians, mobile pharmacy/lab staff, and authorized programme workers.

**System of record for:**

- person-supplied observations, questionnaires, diaries, and patient-reported outcomes;
- communication, accessibility, and channel preferences;
- appointment/navigation interactions and acknowledgement;
- education delivered, viewed, and understood;
- adherence, refill, follow-up, and home-care actions;
- household/community encounters and referrals where the App is the authorized field tool;
- home-monitoring readings before professional reconciliation;
- patient experience, complaints, and service feedback.

**It must not own:**

- a diagnosis, signed clinical note, validated result, or dispense merely because it displays one;
- a facility’s clinical record;
- the canonical consent decision — the App collects intent while Core owns and enforces the directive;
- an unsafe autonomous symptom diagnosis or treatment change;
- the user’s health data as a commercial asset.

**North-star measure:**

> Percentage of recommended preventive, treatment, referral, or follow-up actions completed by the intended person within the appropriate window.

**Commercial form:** B2B2C health-network client funded through facilities, programmes, payers, employers, public-health partnerships, or approved premium services. Patients are not seats in a tenant licence, and health data is not the product.

**Offline form:** Encrypted device database for personal and bounded field workflows, with shared-device safeguards and assisted/SMS/USSD/voice/print alternatives.

**First production boundary:** Identity/affiliation -> appointments/referrals -> approved health summary/results/medicines -> reminders and adherence -> patient-generated observations -> escalation and follow-up.

### 3.4 Synapse Core/Grid charter

**Mission:** Make authorized information and health-system actions reliably available at the point of need without loss, duplication, unsafe delay, or loss of sovereignty.

**Primary consumers:** All three products, approved partners, facility edges, country data planes, national systems, payers, laboratories, supply networks, and governed analytics.

**Owns:**

- accounts, devices, sessions, MFA, and token audiences;
- organizations, facilities, locations, memberships, credentials, and scopes;
- person registry, MPI, identifiers, links, merge/unmerge, and guardianship;
- consent, lawful purpose, restrictions, disclosure, and access policy;
- terminology, clinical content versions, forms, rules, and country packs;
- command, event, outbox/inbox, worker, retry, dead-letter, and replay contracts;
- sync devices, leases, changes, checkpoints, conflicts, and recovery;
- FHIR/HIE, DHIS2, LIMS/device, imaging, supply, payer, payment, and registry adapters;
- communications, delivery receipts, preferences, and escalation;
- indicators, lineage, data quality, de-identification, analytics, and governed AI;
- immutable audit, provenance, security operations, and platform observability.

**It must not become:**

- a fourth end-user app;
- an unrestricted global administrator for clinical records;
- one central database for all African patient data;
- a dumping ground for product-specific logic;
- an excuse for every product to write every table.

**North-star measure:**

> Percentage of authorized clinical and operational transactions completed without loss, duplication, or unsafe delay across online and offline operation.

---

## 4. Current repository truth by product

### 4.1 Footprint

| Area | Current footprint | Interpretation |
|---|---:|---|
| Synapse OS / web | 246 pages, 116 route handlers, about 43.5k active TS/TSX/JS/CSS lines | Very broad route catalogue, uneven implementation |
| Synapse Pharm | 34 pages, 62 route handlers, about 35.2k active TS/TSX/JS/CSS lines | Deepest operational product, but high-risk integrity/offline gaps |
| Synapse App | 23 Expo route/layout files, about 6.1k active TS/TSX lines | Role-aware, mainly read-oriented companion |
| Shared packages | 31 active source files, about 16.3k lines including a 13k-line generated DB type | Shared auth/config/db/email/UI, but weak domain boundaries |
| Database history | 33 SQL migration files, 105 `CREATE TABLE` statements, but only 69 unique public/unqualified table names plus 12 demo names | Overlapping baselines cannot reconstruct the typed/runtime schema |
| Generated database types | 181 public tables | Much larger than reproducible migration ownership and active use |
| Literal web placeholders | 118 of 246 pages, about 48% | Page count substantially overstates working capability |
| Automated tests | 8 pharmacy test files; none found for OS, App, shared packages, or migrations | Quality investment is severely product-imbalanced |

The measurements describe the checked-out repository, not guaranteed deployed state. Historical documents quote different live-database totals; live objects, grants, policies, triggers, extensions, jobs, storage, and drift must be inventoried before production decisions.

### 4.2 Synapse OS capability truth

| Capability family | Current maturity | Evidence-based reading | Required next proof |
|---|---|---|---|
| Marketing, applications, demo | Partial/substantial | Broad public surface and demo exist; claims exceed verified behaviour. | Product-truth registry drives every claim and demo label. |
| Platform control plane | Partial | Tenant/provisioning, subscriptions, flags, support, broadcasts, billing documents, and some health views exist. | Separate operational control plane; measured health and no default PHI access. |
| Facility organization/admin | Partial and duplicated | `/admin`, `/hospital/admin`, and `/os/[slug]` overlap. Some CRUD APIs are real. | One canonical facility workspace and redirect/deprecation plan. |
| Patient registry/HIM | Early partial | Basic registration, search, MRN, and chart paths exist. | MPI, identifiers, match confidence, merge/unmerge, guardianship, amendment, disclosure. |
| OPD/triage | Early partial | `/dept/opd/queue`, patient registration, queue and triage handlers have material code. | Full visit acceptance test through signed close/follow-up. |
| Doctor/encounter | Facade with narrow exceptions | Doctor, consult, and encounter route families are mostly literal placeholders. | Safe workspace, note lifecycle, diagnoses, orders, reconciliation, signature/addendum. |
| Nursing/IPD | Facade/schema | Beds and handover tables/concepts exist; nurse pages are placeholders. | ADT, bed board, nursing plans/tasks, observations, eMAR, handover, discharge. |
| Laboratory | Facade/schema | Table concepts exist; most UI and instrument route behaviour is placeholder. | Order/specimen/result/QC/verification/critical-result loop plus analyzer edge. |
| Imaging | Facade/schema | Route and report concepts exist without RIS/PACS/DICOM workflow. | Order, scheduling, worklist, report, image link, critical finding, DICOM gateway. |
| Maternity/newborn/child | Facade/schema | Named routes and some tables, not safety-reviewed care pathways. | SMART-aligned ANC, labour, PNC/newborn, immunization, growth, referral. |
| Emergency/referral | Facade/early partial | Triage concepts exist; referral handler and most pages are fixed-success/placeholders. | Closed-loop accept/transport/handoff/outcome flow with downtime packet. |
| HIV/TB/malaria/NCD/mental health | Facade or absent | Several programme/specialty route names; no complete programme lifecycle. | Country-approved programme packs on shared primitives. |
| Diagnostics-to-care loop | Absent end to end | Orders, results, notifications, and responsibility do not form one verified loop. | Critical-result acknowledgement and action closure. |
| Hospital dispensing | Early partial | Legacy queue/inventory pages query tables; no full signed eRx-to-dispense reconciliation. | Shared medication-order contract with Pharm or hospital-pharmacy module. |
| Revenue/claims | Partial | Subscription billing plus hospital invoice/payment/claim concepts; several claim APIs are placeholders. | Charge, invoice, payment, claim, remittance, denial, refund, close, audit. |
| Telehealth | Prototype | Intake/booking concepts; video room and operating model are incomplete. | Approved service model, secure communications, escalation, documentation, eRx, follow-up. |
| Patient portal/wellness | Split and partial | `/health` has material but inconsistent direct database usage; `/patient` is mostly placeholder. | One consent-governed PHR rather than competing portal identities. |
| Public health/RHIS | Facade/schema | Surveillance concepts exist; epidemiology pages are placeholders; DHIS2 only queues logs. | Versioned indicator engine, payload, validation, submission, acknowledgement, correction. |
| FHIR/HIE | Facade | CapabilityStatement advertises resources whose handlers return fixed-success JSON. | Authenticated, profiled, validated, versioned conformance service. |
| Offline/edge | Absent | No OS service worker, local transactional authority, sync client, or facility edge. | Edge vertical slice with outage/restart/replay/conflict tests. |

### 4.3 Synapse Pharm capability truth

| Capability family | Current maturity | Evidence-based reading | Required next proof |
|---|---|---|---|
| Tenant onboarding and SaaS billing | Partial/substantial | Registration, invitations, onboarding, plans, billing, domains, and subscription gates exist. | Safe lifecycle, data export, grace/read access, entitlement and payment reconciliation. |
| Staff and permissions | Partial | Pharmacy settings and capability tests exist, but role catalogues and auth models remain split. | One membership/capability source with separation-of-duty tests. |
| Product/packages/batches | Substantial | Detailed inventory, packages, batches, regulatory fields, imports, and APIs exist. | Canonical master, validated units, immutable stock ledger, count/reconciliation. |
| Procurement/suppliers/receiving | Partial/substantial | Supplier and purchase-order surfaces are large; lifecycle verification is incomplete. | Approved PO -> receipt -> batch/quality -> liability -> return, all audited. |
| POS | Operational candidate, online | Deep UI, sale APIs, and FEFO/idempotency tests exist, but checkout writes `pharmacy_pos_*` while major reports/refunds still read `pharmacy_transactions`; discounts appear double-counted and idempotency is non-atomic. | One authoritative sale/stock/payment ledger; authoritative price/tax/discount; atomic command idempotency; reversal, restore, and field pilot. |
| Offline POS | Unsafe facade | `offlineStorage.ts` is a no-op while callers can receive fake HTTP 200, print a receipt, and clear a cart. | Disable immediately; replace with encrypted local command authority and reconciliation. |
| Prescription/dispensing | Early partial | IDs and “requires prescription” flags exist, but no complete clinical eRx verification/partial-fill/safety loop. | Signed prescription, patient match, pharmacist verification, dispense, substitution and clinical feedback. |
| Medication safety | Unsafe/partial | AI interaction path can fail open; deterministic knowledge governance is absent. | Validated source, allergy/interaction/dose rules, unavailable state, pharmacist override reason. |
| Customers/refills/credit | Partial | Customer, orders, refills, credit ledger, and related APIs/pages exist. | Consent/contact policy, balances from immutable ledger, due-work queues, outcome tracking. |
| Refunds/reversals | Partial | Refund surfaces exist. | Reversal-based financial/stock model with approvals and reconciliation. |
| Network availability | Prototype/partial | Pharmacy network configuration and snapshots exist; App discovery/refill path is not closed. | Versioned availability projection with freshness, identity, reservation, and patient privacy. |
| Traceability/recall/pharmacovigilance | Mostly absent | Product regulatory fields exist but end-to-end trace, recall, quarantine, adverse-event, and regulator exchange do not. | GS1-compatible event/provenance model and closed recall journey. |
| Controlled medicines | Absent/inadequate | No verified controlled-register and offline authority policy. | Country-pack rules, double sign, balance, inspection, discrepancy and destruction workflows. |
| Reporting/observability | Partial | Large reports surface and platform summaries exist. | Reconciled metrics, query/performance proof, lineage, exports, anomaly/action workflows. |
| Test coverage | Narrow | Eight test files focus mainly on POS/auth/capabilities. | Database, API contract, portal, offline, financial, security, restore and e2e coverage. |

### 4.4 Synapse App capability truth

| Capability family | Current maturity | Evidence-based reading | Required next proof |
|---|---|---|---|
| Authentication/session | Partial | Password + email OTP, revocable token, SecureStore, and push registration exist. | Unified identity, audience binding, device trust, recovery, revoked/offline behaviour. |
| Role-aware navigation | Partial/substantial | Patient, clinician, nurse, reception, pharmacy, lab, billing and admin views are mapped. | Membership/workspace switching and server-authoritative capabilities. |
| Patient records/medicines/results | Read-oriented partial | List/detail screens and mobile APIs exist, but some APIs equate account/profile IDs or `patients.created_by` with patient identity. | Real person/MPI affiliation, provenance, understandable summaries, acknowledgement, amendment/request, and proxy access. |
| Clinical queue/patient lookup | Read-oriented partial and over-broad | Queue and patient screens consume OS mobile APIs; at least one patient-detail path lacks an adequate role/capability/patient-relationship decision. | Safe stale/offline state, relationship/capability enforcement, bounded mobile mutations, and BOLA tests. |
| Pharmacy stock view | Read-oriented partial | Inventory and stock details are available to roles. | Correct organization/site scope, durable alerts, no stale data represented as current. |
| Lab/claims dashboards | Read-oriented partial | List screens and APIs exist. | Task/action workflows, acknowledgement and responsibility. |
| Appointments | Partial | Listing/detail and cancellation exist; booking deep-links to web. | Native request/booking, offline submission, triage/referral, reminders and closed attendance. |
| Consent and patient rights | Mostly absent | No complete directive, guardian, disclosure, export, correction, or complaint workflow. | Core-enforced consent and rights lifecycle with accessible explanations. |
| Caregiver/household | Absent | No robust proxy/guardian/household authority model. | Verified relationship, age/sensitivity rules, switching, revocation, audit. |
| VHT/CHW/community | Absent from active App | Product vision mentions community roles but field workflows are not built. | Encrypted due lists, visits, screening, referral, campaigns, supervision, shared-device safeguards. |
| Adherence/care plans | Mostly absent | Medication display and reminders are not a full care-plan engine. | Due-action plan, completion/evidence, missed-action escalation, care-team feedback. |
| Remote monitoring | Prototype/absent | Wellness/device concepts exist mostly in web. | Device provenance, thresholds, clinician reconciliation, alert responsibility and safety. |
| Telehealth | Prototype/redirect | App does not own a complete regulated telehealth journey. | Intake, consent, communications, visit, escalation, documentation, eRx and follow-up. |
| Offline | Read cache only | Dashboard cache uses unencrypted AsyncStorage keyed only by URL. Most screens fetch live. | Encrypted identity/workspace-scoped DB, outbox, change feed, purge and conflict UI. |
| Mobile privacy | Unsafe | Cache can cross sessions; logout does not clear it; lock can fail open; push may expose clinical detail. | Encrypted vault, logout/revocation purge, fail-closed lock, discreet notifications. |
| Testing/release | Inadequate | No App tests found; current TypeScript graph has a React 18/19 collision. CI does not verify the App. | Unit, contract, Android/iOS, offline, accessibility, security, crash and release gates. |

### 4.5 Synapse Core/Grid capability truth

| Shared capability | Current maturity | Main gap |
|---|---|---|
| Identity and sessions | Partial and fragmented | Custom sessions, Supabase Auth remnants, pharmacy settings, and mobile tokens do not form one model. |
| Organization/tenancy | Partial | One `profiles.tenant_id`/role cannot express multi-facility workers, caregivers, networks, partner access, or patient affiliations. |
| MPI/patient identity | Early partial | No mature identifier issuer, matching, clerical review, merge/unmerge, survivorship, or cross-facility record locator. |
| Consent/purpose/rights | Early schema or absent | Boolean/row concepts are not an enforceable versioned policy and disclosure domain. |
| Authorization | Partial | Role/capability tables exist, but product aliases, direct service-role access, and endpoint inconsistencies remain. |
| Terminology/content | Prototype | No governed terminology server, value-set versioning, country-pack content signing, or provenance. |
| Commands/events/workers | Absent | Shared DB writes and fire-and-forget calls replace explicit domain contracts and durable delivery. |
| Offline sync | Schema fragment only | `offline_sync_queue` is not a complete protocol and has conflicting identity definitions across migrations. |
| Interoperability | Facade | FHIR, DHIS2, referrals, LIMS/devices, claims, and other adapters lack conformance and acknowledgement. |
| Communication | Partial | Email/SMS/push exist without a unified consent/preference/delivery/receipt ledger. |
| Audit/provenance | Partial | Some regulated actions log; coverage, immutability, availability, and transactional guarantees are inconsistent. |
| Analytics/indicators | Prototype/partial | Dashboards exist without one indicator-definition, lineage, data-quality, and suppression framework. |
| AI governance | Absent | Direct model calls bypass a complete use-case registry, evaluation, monitoring, and safety gateway. |
| Country packs | Absent | Uganda-specific values are hardcoded throughout. |
| Observability/SRE | Absent/inadequate | No OpenTelemetry/Sentry-style end-to-end tracing found; more than 200 console statements substitute for structured telemetry. |
| Database ownership and reconstruction | Absent | Nearly all domains share `public`; product code frequently queries tables directly; service-role use is broad; checked-in migrations do not create core runtime pharmacy tables or the typed `patients` shape. |

---

## 5. Why the current interconnection is not enough

The products currently interconnect mainly through:

- one Supabase project and shared `public` schema;
- shared `profiles`, `tenants`, pharmacy, clinical, and subscription tables;
- mobile APIs hosted inside the OS/web application;
- direct reads by the mobile dashboard from both clinical and pharmacy tables;
- push helpers and links between web and pharmacy domains;
- product flags and platform provisioning.

That creates fast initial integration but weak long-term boundaries:

1. A schema change can break all three products.
2. Product ownership is ambiguous.
3. A service-role query missing one tenant filter can expose another tenant.
4. One role and tenant on `profiles` cannot represent real health-system relationships.
5. A patient App becomes coupled to internal pharmacy/facility tables.
6. Independent release and rollback are not real if all products require coordinated schema knowledge.
7. Shared tables do not provide delivery acknowledgement, retries, replay, or historical contract versions.
8. National and cross-border exchange cannot safely be modelled as “everyone reads the same database.”

The target is a **domain-modular platform**, not premature microservices:

- one Postgres cluster may be retained initially;
- domains live in owned private schemas;
- each product receives a restricted runtime role;
- product BFFs call typed command/query interfaces;
- durable events cross domain boundaries;
- read projections are optimized per product;
- adapters expose external standards;
- services split physically only for residency, availability, scale, or team ownership.

---

## 6. Target ecosystem architecture

```text
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│      Synapse OS      │  │    Synapse Pharm     │  │     Synapse App      │
│ Facility care + ops  │  │ Medicines + supply   │  │ Person + community   │
│ Facility BFF / API   │  │ Pharmacy BFF / API   │  │ Mobile BFF / API     │
└──────────┬───────────┘  └──────────┬───────────┘  └──────────┬───────────┘
           └──────────── versioned commands, queries, events ───┘
                                      │
        ┌─────────────────────────────┴──────────────────────────────┐
        │ Encrypted device stores | pharmacy edge | facility LAN edge│
        └─────────────────────────────┬──────────────────────────────┘
                                      │
                       resumable synchronization gateway
                                      │
┌─────────────────────────────────────┴─────────────────────────────────────┐
│                          Synapse Core / Grid                              │
│ IAM | Organization | MPI | Consent | Policy | Terminology | Workflow     │
│ Clinical | Orders | Diagnostics | Medication | Pharmacy | Revenue        │
│ Engagement | Communications | Public health | Audit | Indicators         │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │ transactional outbox
                         durable workers / inbox / retry
                                      │
┌─────────────────────────────────────┴─────────────────────────────────────┐
│ FHIR/HIE | DHIS2/eHMIS | LIMS/devices | DICOM | eLMIS/traceability       │
│ provider/facility registries | claims/payers | payments | CRVS | research│
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
              Uganda data plane -> EAC country data planes -> federation

Separate global control plane:
contracts | plans | entitlements | deployments | support | rollout | SRE
No unrestricted clinical-record access
```

### 6.1 Seven planes

| Plane | Responsibility | Non-negotiable boundary |
|---|---|---|
| Trust plane | identity, devices, organizations, memberships, MPI, consent, policy, audit | A client-provided tenant/patient/role never becomes trusted context. |
| Control plane | contracts, plans, entitlements, country-pack assignment, deployment inventory, support | Operational control does not imply clinical access. |
| Health data plane | clinical, diagnostic, medication, pharmacy, financial, engagement, public-health records | Data remains in the approved country/region/dedicated deployment. |
| Edge/offline plane | encrypted local authority, leases, commands, change feed, conflict and recovery | No fake success; accepted work must survive restart and replay. |
| Exchange plane | FHIR, DHIS2, HIE, LIMS, DICOM, supply, claims, payments, registries | Every exchange has validation, acknowledgement, retry, lineage, and operator recovery. |
| Intelligence plane | deterministic rules, indicators, analytics, forecasting, governed AI | AI does not become a source of clinical, dispense, claim, or disciplinary truth. |
| Governance/operations plane | safety, privacy, security, SRE, quality, release, country certification | Named owners can stop release and prove controls. |

### 6.2 Control plane versus health data plane

The platform control plane may know:

- organization and contract identity;
- subscribed products and capabilities;
- assigned country pack and deployment version;
- non-clinical usage totals;
- service health and error state;
- migration/backup/edge version;
- support case and authorized support session;
- billing and entitlement state.

It must not automatically know:

- diagnoses, notes, results, prescriptions, or detailed patient journeys;
- unrestricted pharmacy customer history;
- identifiable public-health case data;
- research data;
- another tenant’s clinical or commercial details.

Support access to health data must be exceptional, purpose-bound, reauthenticated, time-limited, patient/tenant-policy aware, fully audited, and reviewed.

### 6.3 Deployment classes

| Class | Use | Data location | Edge |
|---|---|---|---|
| Pooled country SaaS | small and medium private/faith-based facilities and pharmacies | approved country/regional managed data plane | optional device/pharmacy edge |
| Dedicated enterprise | large hospital/group, insurer, laboratory or chain | isolated project/database/account | facility edge as needed |
| District/programme | government/partner programme across facilities | programme or government-approved data plane | facility/community edge |
| Sovereign/national | MoH or national infrastructure | government/private cloud under national governance | national/regional/facility tiers |
| Humanitarian/remote | intermittent connectivity and mobile populations | approved regional node with bounded replicas | strong device/facility store-and-forward |

There should be no default “one African database.” Regional scale is a federation of country or approved regional data planes with common contracts and explicit exchange agreements.

### 6.4 Independent deployability

Separate Vercel projects are not enough. Each product needs:

- an independent build, test, deploy, rollback, and release train;
- audience-bound sessions/tokens;
- its own BFF and public contract;
- a dedicated database role and owned projections;
- backward-compatible OpenAPI/AsyncAPI/event schemas;
- consumer-driven contract tests;
- compatibility declarations for Core, country pack, edge, and mobile versions;
- health/readiness/dependency endpoints;
- feature rollout that can be reversed without a coordinated release of all products;
- local fonts/assets and deterministic builds;
- documented degradation when Core or another product is unavailable.

Recommended initial runtime roles:

- `os_runtime`;
- `pharm_runtime`;
- `app_runtime`;
- `sync_runtime`;
- `worker_runtime`;
- `interop_runtime`;
- `analytics_runtime`;
- `migration_runtime`.

No product runtime role should own or write every schema.

---

## 7. Identity, organizations, tenancy, and consent

### 7.1 Replace role-plus-tenant with relationship-based identity

The current default:

```text
Profile = user + one role + one tenant
```

cannot safely represent:

- a clinician working at several facilities;
- a locum with time-limited assignments;
- a patient receiving care at several organizations;
- a caregiver acting for several dependants;
- a VHT/CHW serving households and linked facilities;
- a hospital pharmacy and an external dispensing partner;
- a laboratory servicing many facilities;
- referral and temporary cross-facility access;
- supervision, delegation, credential expiry, or suspension;
- platform support without clinical access.

The target:

```text
Account
  └─ Person
      ├─ Patient identity and identifiers
      ├─ Practitioner identity and credentials
      ├─ Caregiver / guardian / household relationships
      └─ Organization memberships
          ├─ Organization and facility/location
          ├─ Role assignment
          ├─ Capabilities and restrictions
          ├─ Department/service point
          ├─ Validity period
          ├─ Delegation/supervision
          └─ Credential and assurance requirements
```

Separate:

- account from person;
- patient record from patient login;
- practitioner licence from software permission;
- contractual tenant from organization, facility, and location;
- global account identity from country/region clinical identity;
- platform support role from clinical role;
- hospital pharmacy location from standalone pharmacy tenant;
- programmatic purpose from blanket facility access.

### 7.2 Trusted request context

Every server command/query should receive an immutable server-resolved context:

```text
actorAccountId
actorPersonId
sessionId
deviceId + assurance
activeMembershipId
organizationId
facilityId
location/department/servicePoint
roleAssignment + capabilities
patient/care-team/guardian relationship
purposeOfUse
consent/restriction decision
breakGlass grant
tenant home region
country pack + policy version
correlationId + traceId
```

Client fields may request a target but cannot assert the trusted actor, tenant, facility, cashier, clinician, consent, or authorization decision.

### 7.3 Master patient index

The registry/MPI must support:

- multiple identifier issuers and facility MRNs;
- national ID only where lawful and never as a requirement for care;
- phone/demographic matching with country-aware normalization;
- deterministic and probabilistic match rules;
- match score, evidence, and explanation;
- clerical review;
- duplicate prevention;
- merge, unmerge, aliases, and survivorship history;
- unknown/emergency, newborn, deceased, refugee, and alternative identifiers;
- mother-baby and household/caregiver relationships;
- record-location and patient-authorized linkage across facilities;
- external identifier mappings with provenance;
- safe App affiliation — a similarly named account never automatically owns a patient record.

### 7.4 Consent and lawful purpose

Consent is not one checkbox. Core must own a versioned directive and policy domain for:

- treatment and care coordination;
- referral/data sharing;
- caregiver/guardian/proxy access;
- communications by channel;
- telemedicine;
- wearable/device data;
- pharmacy network visibility and refills;
- research/secondary use;
- sensitive-programme restrictions;
- cross-border summary exchange;
- expiry, supersession, withdrawal, and emergency exceptions.

The App and OS can collect a directive; Core records and enforces it. Restrictive changes receive high sync priority. Country law may provide other lawful bases, so each country pack requires a lawful-basis and purpose-of-use matrix rather than treating consent as the answer to every disclosure.

### 7.5 Safe SaaS entitlement

Commercial entitlement must never create clinical abandonment or unlawful record lockout.

When a facility or pharmacy is past due:

- emergency/safety workflows remain available according to policy;
- historical record access, legal retention, patient export, audit, recall, and controlled-register duties remain available;
- current locally accepted commands can synchronize;
- administrators can export and hand over data;
- new elective/commercial workflows may enter a governed grace or restricted mode;
- users see explicit state and support options;
- no record is deleted or held hostage.

The current pharmacy middleware redirects nearly the whole portal to billing for an inactive subscription. That needs a healthcare-specific degradation policy before production.

---

## 8. Canonical data ownership

### 8.1 Domain ownership matrix

| Domain | Authoritative records | Command issuers | Authorized projections/consumers |
|---|---|---|---|
| IAM | accounts, credentials, sessions, devices, MFA, recovery | all products | all products |
| Organization | organizations, facilities, locations, departments, memberships, credentials | OS, Pharm, platform lifecycle | all products, interop |
| Registry/MPI | persons, patients, identifiers, matches, merge history, household/guardian relationships | OS, App, authorized imports | OS, Pharm, App, exchange |
| Consent/policy | directives, restrictions, access decisions, disclosure evidence | OS and App collect intent | every domain through policy |
| Scheduling | slots, appointment requests, bookings, queues, reservations | OS, App | OS, App, communications, revenue |
| Clinical | encounters, notes, conditions, allergies, observations, procedures, care plans | OS, authorized field programme | OS, App summaries, orders, public health |
| Orders/tasks | medication, laboratory, imaging, referral, procedure and care tasks | OS, approved rules with human acceptance | Pharm, diagnostics, App, revenue |
| Diagnostics | specimens, results, reports, QC, imaging metadata and acknowledgements | diagnostics domain and adapters | OS, App, public health, revenue |
| Medication | reconciliation, formulary projection, prescription, dispense, administration, intervention | OS and Pharm | OS, Pharm, App, claims |
| Pharmacy/supply | product/site catalogue, procurement, batches, stock ledger, POS, controlled register, recall | Pharm and hospital-pharmacy module | Pharm, approved OS/App availability views |
| Revenue | price-rule version, charges, invoices, payments, refunds, claims, remittances, reconciliation | OS, Pharm, App payment channel, adapters | authorized product and finance views |
| Engagement | preferences, education, reminders, adherence, patient-generated observations and outcomes | App | App and authorized care team |
| Communications | templates, messages, attempts, delivery receipts, channel suppression and escalation | all domains via commands | product views and operators |
| Public health | case/workflow, indicator facts, surveillance events, export evidence | clinical/diagnostics/field source events | authorized public-health and MoH adapters |
| Interoperability | endpoints, external IDs, mappings, messages, acknowledgements, subscriptions | exchange workers/adapters | operator and domain reconciliation |
| Platform | contracts, plans, entitlements, deployment, country-pack assignment | control plane | product gates, never blanket PHI |
| Sync | devices, leases, client commands, inbox, changes, conflicts, checkpoints | device/edge clients and gateway | origin clients and operators |
| Audit/provenance | security, access, disclosure, clinical, financial and supply audit | every domain | authorized audit/compliance |
| Indicators/analytics | definitions, cohorts, calculations, lineage, quality and suppression | governed data pipeline | authorized dashboards/research |

### 8.2 Record rules

- Clinical notes become immutable when signed; corrections are signed addenda.
- Results preserve preliminary, corrected, final, cancelled, and superseded states.
- Prescriptions and dispenses remain separate but reconciled.
- Stock and money are append-only ledgers; balances are rebuildable projections.
- Consent and access decisions preserve the version effective at the event time.
- Every derived summary stores source IDs, versions, timestamps, and transformation lineage.
- Patient-generated and device-generated observations remain distinguishable from clinician-validated observations.
- Deletion is exceptional and policy-driven; routine correction uses status, amendment, reversal, or redaction workflows.
- External IDs never replace internal stable IDs.
- Large documents/images live in governed object storage, not base64 database columns.

### 8.3 Database schema programme

Recommended logical schemas:

```text
iam
organization
registry
consent
clinical
scheduling
orders
diagnostics
medication
pharmacy
revenue
engagement
communications
public_health
interop
sync
audit
analytics
platform
config
private
api
```

Only a deliberately designed `api` schema should be exposed through the Data API. Domain tables and `SECURITY DEFINER` helpers belong in private/non-exposed schemas. Explicit grants and RLS are separate mandatory controls.

This is also urgent because Supabase has changed default Data API exposure for new `public` tables and announced enforcement for existing projects. The migration should adopt explicit API schemas and grants now rather than rely on historical defaults. See [Securing your Data API](https://supabase.com/docs/guides/api/securing-your-api) and the [breaking-change notice](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

### 8.4 Postgres robustness rules

- Apply least privilege; ordinary application requests never use a superuser-like service role.
- Enforce tenant/relationship policy in the database as well as application code.
- Force RLS where the role model requires it and test every product/role/tenant matrix.
- Keep definer functions in private schemas, set an empty/fixed `search_path`, authorize inside the function, and revoke execution from `PUBLIC`.
- Index tenant, organization, facility, patient, status, date, and foreign-key columns used in policy and high-volume workflows.
- Use composite indexes with equality columns before range columns.
- Use partial indexes for active/pending/unsynchronized work queues.
- Use exact numeric/integer minor units for money; never floating point.
- Use `timestamptz` for clinical and operational time with explicit recorded/occurred semantics.
- Use database constraints for invariants; do not rely only on UI validation.
- Use `ON CONFLICT` and command IDs for atomic idempotency.
- Keep transactions short; no external network call while holding stock, cash, bed, or clinical locks.
- Acquire stock/ledger locks in deterministic order to prevent deadlocks.
- Use cursor pagination for large worklists.
- Use connection pooling and product-specific limits.
- monitor `pg_stat_statements`, locks, bloat, vacuum/analyze, connection pressure, and replication.

The checked-in migration validator only checks filenames, non-empty SQL, and a few text patterns. A green `db:check` does not prove that a clean database can be created, upgraded, rolled back, secured, or reconciled with production.

### 8.5 Safe legacy migration pattern

For each current table:

1. Name its owning domain and accountable team.
2. Record the live columns, constraints, indexes, triggers, grants, policies, use, and retention.
3. Create the canonical schema and invariants.
4. Backfill with permanent legacy-to-canonical ID mapping.
5. Reconcile row counts, values, money/stock totals, and orphan relationships.
6. Route all new writes through a command handler.
7. Emit canonical events through the transactional outbox.
8. Expose a read-only compatibility view where required.
9. Move consumers individually and compare old/new results.
10. Freeze legacy writes.
11. Archive/remove only after rollback, audit, and retention windows.

Avoid permanent bidirectional dual writes. They create ambiguous authority and are especially dangerous for clinical, medicine, stock, consent, and financial records.

---

## 9. Commands, events, and product contracts

### 9.1 Command envelope

Every offline or online mutation should have:

```json
{
  "commandId": "globally-unique-time-sortable-id",
  "commandType": "medication.dispense.complete.v1",
  "schemaVersion": 1,
  "aggregateId": "stable-domain-id",
  "expectedRevision": 7,
  "actor": {
    "accountId": "…",
    "personId": "…",
    "membershipId": "…",
    "roleAssignmentId": "…"
  },
  "scope": {
    "organizationId": "…",
    "facilityId": "…",
    "locationId": "…",
    "countryPack": "ug@1.0.0"
  },
  "deviceId": "…",
  "authorizationLeaseId": "…",
  "purposeOfUse": "treatment",
  "occurredAt": "…",
  "submittedAt": "…",
  "correlationId": "…",
  "causationId": "…",
  "payloadHash": "…",
  "payload": {}
}
```

The server inbox stores the command ID and payload hash before/with execution. Replaying the same ID and hash returns the first result; reusing an ID with a different hash is a security/integrity error.

### 9.2 Canonical events

| Event | Producer | Principal consumers |
|---|---|---|
| `registry.patient.created.v1` | Registry | OS projections, App affiliation, interop |
| `registry.patient.merged.v1` | MPI | all projections and external-ID mappings |
| `consent.directive.changed.v1` | Consent | policy engine, OS, App, interop |
| `scheduling.appointment.booked.v1` | Scheduling | OS, App, communications |
| `clinical.encounter.signed.v1` | Clinical | orders, revenue, patient summary, public health |
| `orders.medication.created.v1` | Orders | Pharm fulfilment queue, App care plan |
| `medication.dispense.completed.v1` | Pharm/Medication | clinical history, App adherence, claims |
| `diagnostics.report.released.v1` | Diagnostics | OS, App, public health, revenue |
| `diagnostics.critical-result.acknowledged.v1` | Diagnostics/Clinical | safety audit, care team, quality |
| `pharmacy.stock.movement.recorded.v1` | Pharmacy | availability, replenishment, audit |
| `pharmacy.recall.issued.v1` | Pharmacy/traceability | sites, exposed-patient workflow, communications |
| `referral.created.v1` | Referral | receiving OS, App, transport/communication |
| `referral.accepted.v1` | Referral | sending OS, App |
| `referral.completed.v1` | Referral | sending OS, App, outcome indicators |
| `revenue.invoice.issued.v1` | Revenue | OS/Pharm, App, payer |
| `revenue.payment.settled.v1` | Payment adapter | ledger, receipt, reconciliation |
| `revenue.claim.adjudicated.v1` | Payer adapter | OS/Pharm, App, finance |
| `public-health.case.detected.v1` | Public-health rules | authorized review and MoH adapter |
| `interop.delivery.acknowledged.v1` | Exchange worker | domain/operator reconciliation |
| `sync.command.rejected.v1` | Sync gateway | origin device and operator |
| `sync.command.conflicted.v1` | Sync gateway/domain | origin device and conflict workflow |

Events are written in the same transaction as authoritative state. Delivery is at least once and consumers are idempotent. Supabase Realtime may refresh screens, but it is not a durable event bus.

Every event includes:

- event ID and type/schema version;
- aggregate ID and new revision;
- producer;
- organization/facility/region;
- occurred and recorded times;
- correlation and causation;
- origin command and device;
- sensitivity classification;
- payload hash and provenance.

Generic event envelopes, logs, notifications, and analytics must contain the minimum necessary PHI.

### 9.3 API strategy

- Server Components read through domain query services/repositories.
- Server Actions handle internal UI mutations by invoking command handlers.
- Versioned Route Handlers serve mobile, partner, webhook, and standards APIs.
- Browser components do not query internal tables directly.
- OpenAPI documents synchronous contracts; AsyncAPI or equivalent documents events.
- Every public contract has authentication, authorization, validation, error, idempotency, pagination, rate, version, and deprecation behaviour.
- Contract tests prove App/Pharm/OS compatibility independently of shared TypeScript imports.
- No endpoint returns “success” merely to occupy a route.

---

## 10. Offline-first contract

### 10.1 Definition

Offline-first means:

> An authorized action accepted by a device or facility edge survives network loss, process restart, device restart, retries, duplicate delivery, and later reconciliation without silent loss or duplicate clinical, stock, or financial effect.

Offline-first does not mean:

- a service worker can reopen a page;
- a stale API response is cached;
- the UI says “queued” without durable storage;
- every operation is allowed offline;
- last-write-wins is acceptable for clinical notes, consent, stock, or money;
- a full cloud stack is installed at every site without an operational support model.

### 10.2 Local authority by product/use case

| Use case | Local authority | Approved bounded offline work |
|---|---|---|
| App personal | encrypted SQLite/SQLCipher-equivalent vault | authorized summaries, reminders, diaries, appointment/referral requests, consent restrictions, patient-generated observations |
| App VHT/CHW | encrypted bounded field dataset | due lists, household visits, screening, referral, outreach/immunization forms, stock kits where approved |
| App mobile staff | encrypted task/worklist subset | acknowledged tasks, bounded observations/forms, secure capture pending facility reconciliation |
| Single-counter Pharm | encrypted transactional local store | sale/dispense, till, receipt, and allocated stock movement within policy |
| Multi-counter Pharm | pharmacy/facility LAN edge | shared stock, number allocation, till sessions, dispense and reconciliation |
| Synapse OS clinic | encrypted edge or managed single-node authority | registration, queue, encounter, orders and billing within defined scope |
| Synapse OS hospital | redundant facility LAN edge | registration, ADT, clinical, diagnostics, dispensing, billing, and operations |
| Instruments/adapters | edge gateway | durable raw message capture, validation, store-and-forward and acknowledgement |

### 10.3 Required sync records

**Client command outbox**

- command ID and payload hash;
- actor, membership, facility, device, and authorization lease;
- aggregate/base revision;
- encrypted payload;
- local sequence;
- created/accepted/sent/acknowledged state;
- retry count and last error;
- result or rejection;
- schema and country-pack version.

**Server command inbox**

- command ID and payload hash;
- origin/tenant/device;
- received/processing/completed/rejected/conflicted state;
- authoritative result/revision/events;
- processing lease;
- retry/dead-letter detail;
- tamper/reuse detection.

**Canonical change feed**

- monotonically resumable cursor;
- authorized projection/resource;
- aggregate revision and operation;
- tombstone/supersession;
- source event and sensitivity;
- minimum schema/client version.

**Device checkpoint**

- device, user, membership, and workspace;
- last sent local sequence;
- last acknowledged command;
- last applied server cursor;
- active lease/policy/content versions;
- encryption/key state;
- last healthy sync and reconciliation status.

**Conflict/rejection**

- domain-specific reason;
- competing revisions;
- safety classification;
- automatic policy or required role;
- operator/clinical decision;
- resolution event and full audit.

### 10.4 Conflict policy by domain

| Domain | Default policy |
|---|---|
| Signed clinical note | immutable; later correction is a signed addendum |
| Draft clinical note | field/section merge only where explicitly safe; otherwise author review |
| Allergy | preserve competing facts; clinician reconciles; never silently delete |
| Consent/restriction | version history; most restrictive valid directive wins pending review |
| Patient demographics | field-level provenance plus MPI/clerical review |
| Appointment request | idempotent create; server capacity decision returned |
| Result | append/correct/supersede lifecycle; no overwrite |
| Dispense | command inbox plus stock allocation; exactly-once business effect |
| Stock | append movement ledger; offline reservation/allocation; discrepancy workflow |
| Money | append financial ledger; idempotency; reversal, never overwrite |
| Receipt number | signed number block or globally unique provisional ID mapped later |
| Master data | signed/versioned package; local users cannot overwrite national identifiers |
| Patient-generated observation | append with source/device provenance; clinician validation is separate |
| Task completion | idempotent state transition with expected revision |

### 10.5 High-risk offline rules

- Controlled medicines require country- and facility-specific offline authority.
- A device with expired role/credential/lease cannot create unrestricted high-risk commands.
- Emergency downtime actions are clearly marked and reviewed after restoration.
- Price, tax, formulary, guideline, unit, and terminology masters are signed version packages.
- Stock is allocated/reserved per edge to prevent overselling across disconnected counters/sites.
- Cash/stock close cannot be finalized until local reconciliation rules pass.
- Large attachments use encrypted resumable chunks.
- Clock skew is recorded; server and device times remain separate.
- Revoked/withdrawn consent propagates with high priority.
- User, workspace, and tenant data are cryptographically separated.
- Logout, revocation, device loss, or membership removal triggers key/data purge policy.
- “Saved locally,” “awaiting sync,” “synchronized,” “conflicted,” “rejected,” and “reversed” are distinct visible states.

### 10.6 Facility edge

A supported facility edge should provide:

- LAN API/query and command authority;
- local authentication/authorization lease verification;
- encrypted database and secrets;
- synchronization, checkpoints, and operator console;
- printer, barcode, instrument, and device bridges;
- signed update, staged rollout, rollback, and compatibility checks;
- local backups, restore verification, disk health, and retention;
- UPS/power, disk, CPU, clock, and network telemetry;
- tamper-evident audit forwarding;
- downtime and post-outage reconciliation reports;
- remote support that does not imply unrestricted PHI access.

A full self-hosted Supabase deployment should not automatically be placed at every facility. Self-hosting moves high availability, backup, upgrades, security response, monitoring, and capacity ownership to SYNAPSE. If it is selected, versions/images must be pinned and upgrade-tested against current Supabase changes, including database and gateway changes documented in [Supabase self-hosting guidance](https://supabase.com/docs/guides/self-hosting).

### 10.7 Offline acceptance tests

Every approved offline workflow must pass:

1. network loss before local commit;
2. network loss after local commit but before acknowledgement;
3. process kill during write;
4. device/edge restart;
5. duplicate command delivery;
6. same command ID with a different payload;
7. stale aggregate revision;
8. two disconnected counters modifying the same stock;
9. clock skew and timezone change;
10. expired/revoked authorization lease;
11. schema and country-pack upgrade while commands are pending;
12. long outage and large backlog;
13. partial attachment upload;
14. conflict resolution and audit;
15. backup restore followed by resynchronization;
16. lost/stolen device and remote revocation;
17. no double dispense, stock decrement, charge, payment, or receipt;
18. no accepted command lost.

---

## 11. Flagship cross-product journeys

The ecosystem should be released and measured through completed journeys rather than pages, tables, or module names.

### 11.1 Community-to-PHC acute care

1. App/VHT captures symptoms and danger signs, including offline.
2. Core resolves person/household identity, consent/purpose, and facility route.
3. OS receives a structured referral and records triage/encounter.
4. OS orders diagnostics; the diagnostic loop returns verified results.
5. OS creates a signed medication order.
6. Pharm returns availability, verifies, dispenses, and records payment/claim evidence.
7. App receives approved instructions, follow-up, and escalation.
8. Core calculates de-identified routine/quality/surveillance facts.

**Acceptance:** no re-registration, lost referral, lost prescription, duplicate charge, unsafe substitution, or unacknowledged critical result.

**Measures:** referral attendance, wait time, time to treatment, complete fill, next-action completion.

### 11.2 Pregnancy through newborn follow-up

```text
App/VHT enrolment
-> Core mother identity and pregnancy episode
-> OS ANC risk plan and referrals
-> Pharm supplements/priority commodity continuity
-> OS labour/delivery/newborn record
-> Core mother-baby link
-> App postnatal, danger-sign and immunization actions
-> national indicators with source lineage
```

**Acceptance:** a high-risk pregnancy cannot disappear between community, facility, transport, referral site, pharmacy, and postnatal follow-up.

**Measures:** early ANC, contacts completed, high-risk action closure, facility delivery, PNC windows, mother-baby linkage, priority commodity availability.

### 11.3 Chronic HIV/TB/NCD/mental-health continuity

1. OS creates the care plan, monitoring schedule, and clinical orders.
2. Pharm receives the valid prescription/refill plan and maintains stock/dispense continuity.
3. App supports privacy-sensitive reminders, adherence, symptoms, patient-reported outcomes, and home observations.
4. Abnormal or missed actions enter a reviewed work queue.
5. Clinician reconciles data and updates the plan.

**Acceptance:** patient-entered data remains distinct from validated clinical data; no algorithm autonomously diagnoses or changes treatment.

**Measures:** retention, refill gaps, monitoring completion, control/suppression as programme appropriate, loss-to-follow-up, stock-out days.

### 11.4 Closed-loop diagnostics

```text
OS order
-> diagnostic acceptance
-> specimen/image collection
-> processing/QC
-> verified report
-> critical-result escalation and acknowledgement
-> clinician action
-> App-approved result explanation and next action
```

**Measures:** order-to-collection, collection-to-result, rejection, critical acknowledgement, patient informed, next action closed.

### 11.5 Prescribe-to-dispense-to-outcome

```text
OS signed e-prescription
-> Pharm patient/order verification
-> formulary/stock/safety check
-> pharmacist decision and partial/substitute handling
-> dispense + stock + charge/claim
-> App instructions/adherence/refill
-> adverse event or outcome back to OS/Pharm/regulator
```

**Measures:** reconciliation, complete/partial fill, safety intervention, time to access, inability-to-obtain medicine, adverse-event closure.

### 11.6 Immunization and community outreach

1. Core identifies the due cohort from approved schedules.
2. App/VHT receives an encrypted offline worklist.
3. Pharm/supply confirms vaccine/commodity availability where in scope.
4. OS/field service records administration, contraindication, refusal, or referral.
5. App/caregiver receives proof and the next date.
6. Core updates aggregate reporting without duplicate entry.

**Measures:** age-appropriate coverage, dropout, missed opportunity, defaulter recovery, stock-out, wastage, AEFI follow-up.

### 11.7 Emergency and referral across weak connectivity

```text
offline triage
-> minimal signed referral packet
-> target facility/transport routing
-> acceptance and handoff
-> receiving OS treatment
-> medicine/blood/service readiness
-> outcome returned
-> eventual full synchronization and audit
```

**Measures:** request-to-accept, arrival-to-triage, time to definitive care, handoff completeness, referral closure.

### 11.8 Financial protection

1. App/OS presents an understandable estimate and coverage state.
2. OS records services and clinical evidence.
3. Pharm records medicine dispense and co-pay evidence.
4. Core/payer adapter submits eligibility, preauthorization, claim, and evidence.
5. Adjudication/remittance updates the ledger.
6. App presents one understandable receipt and outstanding responsibility.

**Measures:** estimate variance, eligible coverage applied, first-pass acceptance, denial/turnaround, duplicate billing, reconciliation, foregone care due to cost.

### 11.9 Outbreak and service-disruption response

1. Community, OS, diagnostics, and governed Pharm aggregate signals enter Core.
2. Versioned rules detect a possible signal without declaring an outbreak.
3. Authorized public-health staff verify/classify.
4. Case, referral, laboratory, resource, and stock worklists activate.
5. App delivers approved risk communication through appropriate channels.
6. Actions, response time, coverage, and after-action review are measured.

**Measures:** source-to-notification, signal-to-verification, verification-to-response, reporting concordance, message delivery/comprehension, service continuity.

### 11.10 Product recall

```text
regulatory recall
-> Core product/batch identity
-> Pharm affected stock/sites and quarantine
-> OS lawful exposed-patient cohort
-> App targeted instructions
-> returns/destruction/replacement
-> regulator acknowledgement and closure
```

**Measures:** trace completeness, location time, patient reach, quarantine time, return/destruction reconciliation, recall closure.

### 11.11 Rehabilitation, disability, palliative care, and ageing

OS owns functional assessment and multidisciplinary care plan; Pharm maintains essential/palliative medicine continuity; App supports home/caregiver tasks and patient-reported function/symptoms; Core routes social/assistive-device services.

**Measures:** functional goals reviewed/achieved, home-plan completion, assistive-device delivery/maintenance, symptom control, avoidable emergency use, caregiver burden.

### 11.12 Environmental and multisectoral continuity

SYNAPSE should support, not claim ownership of:

- nutrition and food-security referral;
- WASH/environmental-health inspection;
- road-traffic and injury surveillance;
- climate/flood/heat service-disruption alerts;
- social-service and protection referrals;
- occupational health;
- geospatial planning and resource readiness.

**Measures:** cross-sector referrals closed, deficiencies resolved, injury notification completeness, climate downtime, at-risk people reached.

---

## 12. Health-problem-to-product map

| Health-system problem | OS contribution | Pharm contribution | App contribution | Core contribution |
|---|---|---|---|---|
| Fragmented records | complete encounters, orders, results, summaries | dispense/medicine history | person access and affiliation | MPI, consent, provenance, exchange |
| Late presentation | triage/referral response | community commodity/refill readiness | screening, navigation, danger signs | routing, campaigns, geospatial service directory |
| Maternal/newborn risk | ANC/labour/PNC/newborn pathways | priority commodity availability | reminders, birth preparedness, VHT follow-up | mother-baby link, SMART content, indicators |
| Child health/immunization | immunization, growth, sick-child care | vaccine/commodity trace | caregiver schedule and due actions | eligibility, deduplication, reporting |
| HIV/TB/malaria | programme care, labs and cohorts | regimen/refill continuity | privacy-sensitive adherence/escalation | segmentation, definitions, surveillance |
| NCD/mental health | longitudinal plan and monitoring | chronic refill and safety | home measures and PROs | registries and risk-stratified worklists |
| Diagnostic delay | order/specimen/result/acknowledgement | diagnostic commodity support | preparation, navigation, result action | routing, delivery, escalation |
| Medicine stock-out/wastage | prescription/demand signal | procurement, batches, FEFO, distribution | authorized availability and access reports | product/facility registries and traceability |
| Unsafe medication use | indication, allergy and reconciliation | pharmacist verification/intervention | instructions, adherence, adverse-event report | deterministic knowledge and medication contract |
| Workforce scarcity | role worklists, tasking, documentation support | pharmacy workload/supervision | self-service/asynchronous follow-up | credentials, delegation, workload analytics |
| Financial barriers | charges, estimate, claim evidence | medicine price/claim evidence | understandable costs, payment and receipts | benefit, payer, payment and fraud adapters |
| Weak quality/safety | checklists, incident/QI workflow | medication/pharmacovigilance safety | experience and complaints | rule versions, audit, indicators |
| Weak RHIS/surveillance | source care events | governed aggregate supply signals | field/community source events | deduplication, indicators, DHIS2/surveillance |
| Rural/displaced exclusion | edge operation and alternate ID care | remote stock and distribution | offline/assisted/SMS/voice/shared-device modes | federated identity, minimal summary, country policy |
| Poor accountability | clinical/operational audit | stock/money/controlled ledger | disclosure and patient feedback | immutable audit, lineage, reconciliation |

The detailed target feature universe remains in [Section 13 of the master blueprint](./SYNAPSE_MASTER_BLUEPRINT_2026.md#13-complete-target-capability-universe). That catalogue is a universe for build/partner/integrate decisions, not a promise to build everything at once.

---

## 13. Policy and health-system alignment

### 13.1 WHO alignment

| WHO direction | Required ecosystem interpretation |
|---|---|
| Primary health care | Connect person/community, PHC, referral care, diagnostics, pharmacy, and financing around a longitudinal journey. |
| GPW14: promote, provide, protect | Prevention and determinants; quality PHC/UHC and financial protection; surveillance, emergency readiness, and resilience. |
| SMART Guidelines | Use versioned, testable, software-neutral clinical content rather than hardcoded vendor workflows. |
| RHIS strategy | Generate routine information from source care/supply events once and calculate approved indicators reproducibly. |
| CDISAH | Describe digital interventions through health-system needs and goals, not only software modules. |
| DIIG | Prioritize verified needs and national architecture; cost implementation and avoid point-solution proliferation. |
| Digital Health Platform Handbook | Place reusable trust, exchange, workflow, and data services below point-of-service products. |
| Digital intervention guideline | Do not present digital tools as substitutes for functioning health systems. |

Current WHO Digital Adaptation Kits provide useful starting content for areas including antenatal care, HIV, family planning, TB, immunization, postnatal care, pregnancy blood-pressure self-monitoring, birth-defect surveillance, and child health in humanitarian emergencies. Adoption still requires national clinical ownership, localization, terminology, testing, versioning, and governance.

### 13.2 Uganda alignment

The Uganda pack and delivery portfolio should explicitly support the National Health Compact pillars:

- prevention, health promotion, and community systems;
- quality and capacity of service delivery;
- health workforce;
- sustainable financing and financial protection;
- multisectoral action and determinants;
- governance, accountability, evidence, and partnership.

It should also align with:

- the [Uganda Health Information and Digital Health Strategic Plan](https://library.health.go.ug/index.php/health-information-systems/digital-health/uganda-health-information-and-digital-health-strategic);
- the [Compendium of National Digital Health Guidelines](https://library.health.go.ug/index.php/health-information-systems/digital-health/compendium-national-digital-health-guidelines);
- Uganda health-information-exchange guidance;
- national HMIS/eHMIS and programme reporting decisions;
- approved facility/provider/identity integration pathways;
- the [Uganda National Health Products Traceability Strategy](https://library.health.go.ug/node/1686), including standardized master data, automatic identification/data capture, interoperability, and incremental GS1 adoption;
- professional, pharmacy, medicines, privacy/data-protection, telemedicine, insurance, payment, civil-registration, and research obligations.

National Compact indicators may be shown as **contribution indicators**, not claimed as SYNAPSE-owned outcomes. The current Compact includes ambitions around UHC coverage, catastrophic expenditure, tracer commodities, community/VHT reach, immunization, facility delivery, workforce, insurance, and client satisfaction. Any conflicting target values must be resolved with MoH and versioned rather than silently selected by the vendor.

### 13.3 EAC alignment

Regional architecture should advance:

- interoperable country systems rather than new vertical donor silos;
- common trust, terminology, exchange, and certification approaches;
- governed cross-border continuity for mobile populations;
- public/private provider participation;
- regional surveillance and supply-disruption coordination;
- country sovereignty and bilateral/regional legal agreements;
- staged readiness rather than identical deployment everywhere.

The EAC has explicitly described health enterprise architecture and data governance as mechanisms to reduce fragmented vertical applications. SYNAPSE should participate as a conformant platform, not attempt to replace national governance.

### 13.4 Africa CDC alignment

Country/facility readiness should be assessed across the Africa CDC HIEMAT domains:

1. leadership and governance;
2. workforce and management;
3. ICT infrastructure;
4. standards and interoperability.

SYNAPSE should support the Africa CDC emphasis on accessible, affordable, equitable, scalable, accountable, secure, and locally sustainable digital health, including digitally enabled PHC and homegrown health technology.

### 13.5 Global scale

Global expansion requires:

- one universal health-platform contract;
- one certified country pack per jurisdiction;
- regional/dedicated data planes;
- local clinical, legal, terminology, implementation, and support ownership;
- conformance to national and international standards;
- build/partner/integrate decisions;
- no assumption that Uganda workflows, roles, payer models, identifiers, taxes, languages, or laws generalize unchanged.

---

## 14. Universal core, country pack, and tenant configuration

### 14.1 Universal core

- account, person, practitioner, patient, caregiver, household, organization, facility, and location primitives;
- MPI/match/merge framework;
- consent, purpose, authorization, disclosure, and provenance;
- care plan, task, order, result, referral, medication, dispense, charge, and ledger primitives;
- terminology/value-set/mapping framework;
- forms, rules, workflow, content, and indicator engines;
- event/outbox/inbox and offline sync protocol;
- conflict policies and immutable command IDs;
- notification abstraction across push, SMS, USSD, voice, email, and print;
- FHIR/OpenHIE-compatible exchange framework;
- claims, payment, and reconciliation abstractions;
- de-identification, data quality, lineage, and governed research export;
- security, observability, backup, disaster recovery, and tenant isolation;
- localization and configuration framework.

### 14.2 Country pack

Each signed, versioned, effective-dated country pack contains:

- administrative geography and facility hierarchy;
- identifiers, identity rules, and alternative/refugee/emergency identity;
- facility/provider/professional registry connectors;
- legal bases, consent, age/capacity, retention, residency, breach, and rights policy;
- essential health-service package and referral hierarchy;
- practitioner cadres, scopes, delegation, and licensing sources;
- national clinical protocols and adopted SMART artifacts;
- HMIS/DHIS2 forms, metadata, indicators, schedules, and corrections;
- reportable conditions, case definitions, and escalation thresholds;
- essential medicines/formulary, product registry, units, pack sizes, storage, and traceability;
- GS1/NDA or equivalent product rules;
- laboratory units/reference ranges and diagnostic catalogues;
- immunization schedules and certificates;
- payer, tariff, claim, tax, fiscal receipt, and payment adapters;
- currency, rounding, dates, calendars, phones, addresses, and timezone rules;
- languages, clinically reviewed translations, accessibility, and low-literacy content;
- birth/death/CRVS integrations;
- national privacy, AI, research, and secondary-use restrictions;
- cross-border minimum-summary policy;
- service-readiness and quality standards.

### 14.3 Tenant configuration

A facility, district, pharmacy, or chain may configure:

- departments, wards, locations, hours, and service points;
- local services and price contracts;
- staff assignments and rosters;
- stock thresholds and approved suppliers;
- referral partners;
- local templates/order sets within country rules;
- printer/device/instrument endpoints;
- branding and communication preferences;
- approved workflow variation.

A tenant cannot weaken mandatory national safety, privacy, reporting, credential, or traceability rules.

### 14.4 Country-pack governance

Every pack requires:

- governmental/clinical owner and SYNAPSE steward;
- semantic version and effective/retirement dates;
- source references and licensing;
- clinical, legal, privacy, terminology, and public-health review;
- machine-readable content and automated conformance tests;
- signed release artifact;
- dependency and minimum-client versions;
- staged rollout and safe rollback;
- historical reproducibility of every decision/indicator;
- change communication and retraining;
- no unilateral vendor change to national policy or clinical content.

---

## 15. Interoperability as a product

FHIR should be an external projection of canonical domains, not the internal database and not a label on a fixed-success handler.

### 15.1 Exchange capabilities

- FHIR R4/R4B baseline confirmed with each national authority;
- country implementation guides and profiles;
- SMART/OAuth authorization, audience, purpose, consent, and scopes;
- CapabilityStatement that exactly matches tested behaviour;
- profile/value-set validation and `OperationOutcome`;
- search, pagination, version/history, conditional operations, bundles, provenance, subscriptions where approved;
- deterministic, versioned, reversible mappings with source lineage;
- OpenHIE-aligned client, provider, facility, terminology, shared-record, and interoperability components;
- durable delivery, acknowledgement, retry, dead letter, replay, correction, and reconciliation;
- partner onboarding, sandbox, conformance suite, certification, version support, and deprecation.

### 15.2 National and partner adapters

| Adapter | Required lifecycle |
|---|---|
| DHIS2/eHMIS | indicator definition -> source lineage -> validation -> payload -> submission -> acknowledgement -> correction/reconciliation |
| LIMS/instruments | authenticated raw message -> parse/validate -> patient/order/specimen match -> result/QC -> acknowledgement -> exception queue |
| Imaging | order/worklist -> DICOM/DICOMweb -> report -> critical finding -> image access policy |
| HIE/shared summary | identity/consent/purpose -> profile validation -> exchange -> acknowledgement -> disclosure record |
| Facility/provider registries | authoritative lookup, caching, provenance, expiry, reconciliation |
| eLMIS/NMS/JMS/supply | product/facility identity, order/stock/shipment/receipt/shortage, acknowledgement |
| Product traceability | GS1-compatible identifiers and EPCIS-like events, verification, recall, quarantine, destruction |
| Payers/claims | eligibility -> preauthorization -> claim/evidence -> adjudication -> remittance -> appeal/reconciliation |
| Payments | signed webhook -> provider transaction -> settlement -> refund/reversal -> reconciliation |
| CRVS | governed birth/death notification and acknowledgement |
| Surveillance | versioned case/event definitions, verification, notification, update, closure |

Every adapter has an accountable owner, SLO, data-sharing agreement, security profile, test environment, mapping version, failure queue, operator controls, and audit.

### 15.3 Cross-border exchange

Regional continuity should exchange a minimal authorized summary, not copy a continent-wide record. Depending on law and purpose, it may contain:

- verified demographic/identifier references;
- allergies;
- current medicines;
- major active conditions;
- recent critical procedures/results;
- vaccination summary;
- emergency contacts;
- consent/legal purpose;
- provenance and expiry.

Exchange requires country law, bilateral/regional agreement, minimum disclosure, authentication, purpose, revocation/expiry, audit, and an accountable receiving organization.

---

## 16. Security, privacy, clinical safety, and AI

### 16.1 Security baseline

- private domain schemas and explicit API exposure;
- least-privilege product/runtime roles;
- RLS plus server policy — neither is treated as sufficient alone;
- no ordinary service-role requests;
- product-specific token audiences and short access-token lifetimes;
- one identity authority with product sessions and device trust;
- MFA/passkeys/SSO appropriate to risk;
- role plus organization, facility, relationship, purpose, consent, credential, time, device, and sensitivity attributes;
- platform support denied clinical access by default;
- break glass with reauthentication, reason, scope, timeout, alert, and review;
- encryption in transit, at rest, and on edge/device;
- mTLS or signed channel for trusted adapters/edges;
- secrets manager, rotation, and no secrets in logs/URLs;
- CSP, HSTS, secure cookies, CSRF, origin, upload, malware, and content controls;
- distributed rate limiting that fails safely for auth/AI/high-risk endpoints;
- immutable security/access/disclosure audit;
- dependency/SAST/secret/container/IaC/mobile scanning;
- tenant-isolation, BOLA, role, replay, idempotency, edge, and offline-lease tests.

Current gaps include:

- broad service-role/admin-client use;
- direct browser Supabase queries despite historical documentation saying server-only;
- web API middleware bypass, requiring inconsistent route-level enforcement;
- web rate limiting that fails open if Redis is missing;
- pharmacy in-memory rate limiting that does not provide distributed serverless protection;
- missing CSP and inconsistent security headers;
- no end-to-end security/tenant test suite.

### 16.2 Privacy and patient rights

- processing inventory, controller/processor roles, DPIAs, and data-sharing agreements;
- purpose limitation and data minimization;
- consent/directive and lawful-basis enforcement;
- guardian/proxy and adolescent confidentiality;
- sensitive-programme segmentation;
- patient access, correction, restriction, export, objection/withdrawal, and complaint;
- disclosure accounting;
- retention, legal hold, archive, de-identification, and destruction;
- breach detection, assessment, notification, and evidence;
- shared-device, lock-screen notification, screenshot, clipboard, print, and export policy;
- research approvals, data-access committee, enclave, and output checking;
- accessible, language-appropriate notices that match actual practice.

### 16.3 Clinical safety system

Required:

- named clinical safety officer with stop-release authority;
- clinical risk management file and hazard log;
- intended-use and user definitions;
- workflow safety cases and acceptance evidence;
- clinical content ownership/versioning;
- human factors/usability testing;
- deterministic calculators and medication knowledge where safety critical;
- downtime, wrong-patient, duplicate, stale-data, and alert-fatigue hazards;
- incident/near-miss reporting and corrective action;
- post-release surveillance;
- local validation for rules/models;
- regulatory classification decisions for decision support, telemedicine, devices, and AI.

### 16.4 AI governance

AI may assist with:

- documentation drafts;
- patient-friendly explanation drafts;
- coding suggestions;
- queue/worklist summarization;
- import mapping;
- demand forecasting;
- anomaly prioritization;
- multilingual content drafts subject to review.

AI must not autonomously:

- diagnose;
- prescribe or alter treatment;
- declare a drug combination safe;
- dispense;
- deny eligibility/coverage or submit an irreversible claim;
- determine an emergency is safe for home care;
- verify a practitioner from visual resemblance;
- trigger punitive workforce action;
- publish an outbreak;
- access arbitrary database records.

All AI calls go through a governed gateway recording:

- use-case/risk class and owner;
- model/provider/version and region;
- prompt/template and input classification;
- approved knowledge/content/country-pack versions;
- actor, patient relationship, purpose, consent/legal basis;
- structured output schema;
- human approval/action limits;
- latency, cost, error, abstention, override, and safety event;
- evaluation version and deployment state;
- kill switch and rollback.

If an AI or safety knowledge source is unavailable, the response is “unavailable/unknown,” never “safe.”

---

## 17. Reliability, observability, and data quality

### 17.1 End-to-end trace

Use one correlation chain:

```text
device command
-> sync inbox
-> domain transaction
-> outbox event
-> projection/worker
-> external delivery
-> acknowledgement/reconciliation
-> App/OS/Pharm outcome
```

Track:

- request, command, event, job, and external-message IDs;
- product, version, country pack, tenant/facility, and region;
- latency/error without unnecessary PHI;
- actor/device assurance and authorization decision;
- sync, conflict, retry, dead-letter, and replay state;
- clinical/stock/money reconciliation state;
- external acknowledgements;
- model/rule/content versions.

### 17.2 SLO families

| SLO | Example measure |
|---|---|
| Cloud product availability | successful authorized requests by product/region |
| Edge continuity | local critical workflow availability during uplink loss |
| Sync recovery | P50/P95 time from reconnection to durable acknowledgement |
| Command integrity | accepted commands lost or duplicated |
| Exchange delivery | acknowledgement time and unresolved dead-letter age |
| Critical clinical loop | critical result/referral/medicine alert acknowledged and acted on |
| Financial/stock integrity | unreconciled variance and oldest exception |
| Communication | delivered/failed/suppressed/acknowledged by channel |
| Data quality | required fields, value-set conformance, duplicate/orphan rates |
| Recovery | verified RPO/RTO and restore success |

### 17.3 Indicator architecture

Every KPI should have:

- stable indicator ID and version;
- plain-language purpose;
- numerator and denominator;
- inclusion/exclusion;
- source events and required fields;
- period and disaggregation;
- steward and approval;
- data-quality rules;
- privacy/suppression thresholds;
- country/programme mapping;
- baseline/target;
- accountability level;
- effective dates and calculation lineage.

Examples:

- referral closure = completed referrals with receiving outcome / accepted referrals;
- tracer availability = in-stock item-facility days / expected item-facility days;
- fill rate = prescription lines fully dispensed / valid lines presented;
- inventory accuracy = lines within approved variance / lines counted;
- critical acknowledgement = critical results acknowledged within threshold / critical results released;
- sync durability = offline commands completed exactly once / locally accepted commands;
- source concordance = audited indicators matching reproducible source calculation / audited indicators;
- equity gap = priority-group completion/outcome compared with reference group, with volume/confidence and privacy.

---

## 18. Codebase restructuring

### 18.1 Target monorepo

```text
apps/
  os/                    # Synapse OS product shell
  pharm/                 # Synapse Pharm product shell
  app/                   # Expo patient/community/mobile client
  platform/              # global control plane, no default clinical access
  worker/                # durable outbox/inbox/integration workers
  edge/                  # facility/pharmacy edge runtime and operator UI

packages/
  contracts/
    commands/
    events/
    openapi/
    fhir/
  core/
    iam/
    organization/
    registry/
    consent/
    policy/
    terminology/
    audit/
  domains/
    scheduling/
    clinical/
    orders/
    diagnostics/
    medication/
    pharmacy/
    revenue/
    engagement/
    communications/
    public-health/
  sync/
    protocol/
    client/
    server/
    conflict/
  interop/
    fhir/
    dhis2/
    lab/
    imaging/
    supply/
    claims/
    payments/
  country/
    core-schema/
    ug/
  data/
    repositories/
    migrations/
    generated/
  observability/
  security/
  testing/
  ui/
  config/

supabase/
  migrations/
  tests/
  seeds/
  policies/

docs/
  architecture/
  products/
  countries/
  safety/
  operations/
  decisions/
  evidence/
```

This is a direction, not a big-bang file move. Introduce contract seams first, then migrate vertical slices.

### 18.2 Route consolidation

Current overlapping routes should converge:

| Current surfaces | Target |
|---|---|
| `/admin/*`, `/hospital/admin/*`, `/os/[slug]/*` | one facility workspace under the OS product |
| `/doctor/*`, `/encounter/*`, `/consults/*`, `/dept/opd/*` | one encounter/clinical route model with role-aware workspaces |
| web `/pharmacy/*` and standalone Pharm | shared medication/dispense contracts; one UI owner for each context |
| `/health/*`, `/patient/*`, `app-portal`, Expo App | one person-facing product model with channel-specific UI |
| `/platform/*` mixed with clinical data | separate control-plane app and restricted data access |

Navigation must be generated from:

- product;
- active membership/workspace;
- country-pack capability;
- tenant entitlement;
- facility module;
- user capability;
- feature rollout;
- implementation status.

Placeholder routes should not appear as functional navigation. Hide, delete, or label them as prototypes in non-production environments.

### 18.3 Product BFF boundaries

- `apps/os` may issue clinical/facility commands and consume owned projections.
- `apps/pharm` may issue pharmacy/supply/retail commands and consume medication/identity projections.
- `apps/app` calls a mobile/person BFF; it never reads internal tables.
- `apps/platform` calls control-plane services; clinical support access is a separate audited flow.
- browser code does not call arbitrary `.from()` tables;
- repositories require trusted context and domain scope;
- every cross-domain write becomes a command;
- every cross-product read is a deliberate projection.

### 18.4 Shared package policy

Shared packages contain:

- contracts and schemas;
- pure value objects/calculations;
- security/policy clients;
- design-system primitives;
- telemetry;
- test utilities.

They do not contain:

- one product’s database queries disguised as generic helpers;
- unrestricted admin clients;
- mutable global configuration;
- UI-specific business state shared to force coupling;
- duplicated role/country constants.

The existing `@synapse/ui` package has no active consumer. Either adopt it as the governed cross-product design system with accessibility tests or retire it; an unused package is not a design system.

### 18.5 Break up high-complexity files

Examples such as the Pharm POS (~2,244 lines), inventory (~1,826), orders (~1,637), transactions (~1,103), reports (~1,030), and OS health dashboard (~828) combine view, state, validation, network, and business behaviour.

Refactor by vertical feature:

```text
feature/
  ui/
  state/
  commands/
  queries/
  schemas/
  policies/
  domain/
  tests/
```

Financial, stock, medication, and clinical invariants live in domain/database layers, not 1,000-line components.

### 18.6 Build and release system

Required per product:

- type-check;
- lint with an intentional warning budget trending to zero;
- unit/domain tests;
- database/contract tests;
- production build without network font dependency;
- accessibility checks;
- secret/dependency/SAST scan;
- e2e critical journey;
- artifact provenance/SBOM;
- migration compatibility;
- preview smoke test;
- rollback proof.

Current CI verifies web and pharmacy but not the Expo App. There are no OS/App/shared/migration automated tests, and the current warning/build state can block CI. App must become an equal release citizen.

---

## 19. Documentation reconciliation

### 19.1 What the existing documents currently say

| Document | Useful content | Conflict/problem | Disposition |
|---|---|---|---|
| `README.md` | Correctly lists web/OS, Pharm, and App monorepo packages. | Does not define product ownership/outcomes. | Keep as developer entry; link this operating model first. |
| `SYNAPSEOS_MRD.md` | Ambitious journeys and no-dead-end intent. | Defines only OS and App, promises FHIR/offline behaviour that is not implemented, and treats route existence as completion. | Mark superseded; mine accepted requirements into product specs. |
| `SYNAPSEOS_ECOSYSTEM_FLOW.md` | Describes desired care/referral/public-health flow. | Defines “two products,” assumes APIs/sandbox/FHIR that are not real, and says all flows are functional. | Mark superseded; replace with tested journey specifications. |
| `SYNAPSE_DASHBOARD_BUILD_PROMPT.md` | Recognizes hospitals, pharmacy, mobile users, and many roles. | Implementation prompt, route topology differs from code, pharmacy-first and feature breadth dominate. | Historical input, not architecture or status. |
| `docs/hospital-module-map.md` | Valuable table/route/screen inventory. | “Screen exists” often means an eight-line placeholder; many statuses are stale after later code. | Historical evidence; regenerate status from code/tests. |
| `apps/app/GUIDE.md` | Useful mobile build/auth/navigation guide. | Calls absent `/docs/blueprint` files canonical and overstates app/offline/security status. | Update after App architecture and release contract. |
| `docs/superpowers/plans/*` | Detailed historical implementation thinking. | Multiple phase plans claim different ground truths and priorities. | Treat as dated plans, never current status. |
| `docs/superpowers/reports/*` and `GODMODE_REPORT.md` | Record work performed at a point in time. | Several “complete” claims conflict with current placeholders/build/security evidence. | Immutable historical reports with scope/date disclaimers. |
| `docs/SYNAPSE_MASTER_BLUEPRINT_2026.md` | Detailed technical sweep, risks, capability universe, architecture, roadmap. | Product allocation and three-product parity were not prominent enough. | Technical/evidence annex governed by this operating model. |
| This document | Three-product charter, outcomes, ownership, journeys, sequencing. | Must be converted into decisions and maintained. | Authoritative ecosystem operating model once accepted. |

### 19.2 Documentation hierarchy

```text
1. Ecosystem operating model (why, products, outcomes, ownership)
2. Product charters/PRDs (what each product owns)
3. Country-pack specifications (national policy/content/integrations)
4. Architecture decisions and contracts (how and why)
5. Clinical safety/privacy/security control files
6. Capability truth registry generated from evidence
7. Release specifications and test evidence
8. Historical plans and reports
```

### 19.3 Product truth registry

Every marketed capability should have:

```text
capabilityId
productOwner
domainOwner
healthOutcome
personas
status: proposed | designed | prototype | partial | pilot | production | suspended | retired
country/facility scope
offline scope
data sensitivity
clinical/regulatory risk
contract and UI entry points
tests/evidence
telemetry/SLO
owner
last verified
known limitations
claim text allowed
```

A page, API route, table, feature flag, or plan does not advance status by itself.

---

## 20. Consolidated gap register

The detailed code-level stop-ship register is in [the master blueprint](./SYNAPSE_MASTER_BLUEPRINT_2026.md#4-stop-ship-and-truth-correction-register). The following register groups the work by ecosystem consequence and product balance.

### 20.1 P0 — stop claims or production exposure

| Area | Gap | Ecosystem consequence | Required disposition |
|---|---|---|---|
| Pharm offline | no-op persistence can be reported as success and cart/receipt can advance | lost sale, stock, cash and patient trust | disable simulated success immediately; implement durable local transaction before re-enabling |
| Pharm money/stock | financial/tax/discount/RPC/authorization concerns remain | unreconciled cash/stock and fraud risk | authoritative server/database rules, ledgers, separation of duty, integration tests |
| Pharm sale truth | checkout writes `pharmacy_pos_sales/items`, while dashboards, reports, history, edits, verification, and refunds use `pharmacy_transactions`; command idempotency is not atomic | a committed sale can disappear from reporting/refunds or be duplicated after concurrency/timeouts | select and migrate to one canonical append-only sale ledger; enforce idempotency in the same database transaction |
| Pharm customer identity | unsalted SHA-256, no signed customer session, local-storage identity, and order APIs that trust caller headers | account takeover, cross-customer/cross-tenant order access, and repudiation | disable or replace with Core identity, memory-hard/managed credentials, signed revocable session, and server-derived tenancy |
| Medication safety | interaction path can fail open | unsafe dispense/clinical decision | deterministic validated source; unavailable state; human pharmacist decision |
| App cache | private dashboard cache is unencrypted, URL-only, and not purged on logout | cross-user/tenant PHI leakage | disable private cache or encrypt, namespace, expire and purge |
| App lock/push | device lock can fail open; notifications can reveal clinical detail | device/lock-screen privacy harm | fail closed, secure credential fallback, discreet notification policy |
| App patient identity/access | some APIs equate account/creator IDs with patients and tenant membership with clinical authorization | wrong record association and facility-wide PHI disclosure | introduce verified person/MPI affiliation and enforce role, relationship, purpose, and patient-scoped BOLA checks |
| OS/API auth | broad service-role use and uneven route guards | cross-tenant/role exposure | central trusted context, least-privilege roles, endpoint matrix, BOLA tests |
| OS feature enforcement | hospital provisioning, subscription features, module flags, and parallel encounter endpoints do not share one decision | real registration/OPD paths can be blocked while a weaker path bypasses capability/module gates | one server-authoritative entitlement/capability policy; emergency-safe degradation; eliminate bypass routes |
| Database reconstruction | migrations create only 69 unique public/unqualified table names, generated types describe 181, and core runtime tables plus the typed `patients` shape are missing from migrations | clean install, recovery, test, and rollout cannot reproduce the application contract | live inventory, canonical baseline, upgrade rehearsal, drift gate, and generated type proof |
| AI coach/features | some model paths lack adequate patient relationship/authorization/safety | cross-user access or unsafe guidance | disable high-risk paths until governed gateway and authorization |
| Product truth | offline/FHIR/DHIS2/functional-flow/legal claims exceed evidence | regulator/customer/patient trust harm | capability registry and immediate copy/demo correction |
| Legal/rights | legal pages and rights operations do not match a mature processing programme | invalid notice/consent and unfulfilled rights | approved policies plus operational request workflows |
| Subscription lock | pharmacy access may be broadly blocked for nonpayment | unsafe/unlawful denial of records, recalls, controlled duties | healthcare degradation/grace/read/export policy |

### 20.2 P1 — platform foundation

| Area | Gap | Required programme |
|---|---|---|
| Identity | one role and tenant per profile; mixed custom/Supabase auth | account/person/membership/role assignment/device/session convergence |
| Database source | generated types, migrations, historical live reports, runtime strings, and Prisma disagree | live inventory, canonical baseline, clean reset, drift gate and ownership |
| Database exposure | most objects in `public`, broad admin client, implicit/default grants | private schemas, explicit `api` schema, product roles, RLS/grant tests |
| Migration quality | text-only filename check; no clean apply/upgrade/rollback/data verification | ephemeral DB CI, pgTAP/SQL tests, drift and rollback/restore evidence |
| Domain ownership | products write/read shared tables | private domain schemas, repositories, commands/events and product projections |
| Eventing/jobs | no transactional outbox/inbox and few material workers | durable worker platform, retry, DLQ, operator replay and SLOs |
| Sync | fragmentary queue/conflict tables without protocol/client | full device/edge sync kernel and domain conflict policies |
| Route topology | duplicated facility, clinical, patient and pharmacy surfaces | canonical product route plan and redirects/deprecation |
| Role/facility catalogues | constants, DB constraints, aliases, navigation and country types diverge | generated policy/catalogue from universal core + country pack |
| Audit | coverage and failure semantics vary | mandatory transactional regulated audit plus durable forwarding |
| Local privacy | service-worker/API caches and device stores lack identity policy | encrypted scoped vaults and cache-control policy |
| Rate limiting | web can fail open; pharmacy uses process-local memory | shared distributed abuse controls with endpoint-specific fail policy |
| Security headers | no coherent CSP; permissions may conflict with telehealth | threat-modelled per-product browser security and media policy |
| Observability | console logs and dashboard counts, no trace chain | structured telemetry, end-to-end correlation, SLO/alert/runbooks |
| Build/release | web/pharmacy build issues, App type collision, external fonts, App absent from CI | deterministic product gates and dependency/workspace isolation |
| Test balance | pharmacy has eight files, every other product/domain has none | journey, contract, database, security, offline and mobile test programme |

### 20.3 P2 — complete the ecosystem

| Area | Missing capability |
|---|---|
| OS clinical core | MPI/consent, signed encounter, orders/results, medication, charge, discharge/follow-up/referral |
| OS inpatient | ADT, bed, nursing plan/task, eMAR, handover, discharge |
| Diagnostics | LIS, analyzer gateway, QC, verification, critical acknowledgement, imaging/RIS/PACS |
| Pharm clinical loop | signed eRx, pharmacist verification, partial fills, substitutions, intervention, outcome |
| Pharm supply safety | immutable stock ledger, controlled drugs, traceability, recall/quarantine/destruction, pharmacovigilance |
| App person product | affiliation, consent/rights, caregiver, care plan, appointments, understandable results, complaints |
| App community | VHT/CHW household, due lists, screening, outreach, referral, supervision, shared-device mode |
| Interoperability | conformant FHIR, DHIS2, HIE, LIMS/devices, imaging, supply, claims/payments, CRVS |
| Revenue/financing | episode estimate, clinical/medicine charge, claim, remittance, patient responsibility, reconciliation |
| Public health | source-based indicators, IDSR/case lifecycle, verification, DHIS2 acknowledgement, emergency operations |
| Communications | preference/consent, templates, durable delivery, receipts, retry, suppression, escalation |
| Country packs | Uganda pack and governance tooling |
| Accessibility/localization | i18n, clinically reviewed translations, WCAG/mobile, low-literacy and non-smartphone channels |
| Clinical/AI governance | safety file, content service, model gateway, evaluation, incident surveillance |

### 20.4 P3 — scale, optimization, and ecosystem extension

- federated EAC minimum-summary/referral exchange;
- country certification toolkit;
- partner sandbox and developer certification;
- research enclaves and federated analytics;
- demand/resource optimization after data quality is proven;
- advanced programme and specialty packs selected by outcomes and partners;
- performance/load/capacity engineering from real workloads;
- archive/removal of dead tables, routes, Prisma schema, duplicate auth/UI, and legacy demos;
- build/partner/integrate marketplace and implementation partner network.

---

## 21. Outcome-led delivery roadmap

### Release 0 — truth and safety, 0–30 days

**All products**

- publish capability truth and hide/qualify unsupported claims;
- freeze new placeholder/module creation;
- appoint clinical safety, privacy/DPO, security, architecture, interoperability, and country-pack owners;
- define the first cross-product journey and acceptance suite.

**Synapse OS**

- close unauthenticated/cross-tenant/high-risk paths;
- select one canonical facility/OPD route;
- label/remove clinical facades;
- protect patient/wellness direct database paths.

**Synapse Pharm**

- disable fake offline success;
- fix/verify POS money, stock, RPC permissions, idempotency, and interaction-unavailable state;
- preserve required safety/record access under subscription lock.

**Synapse App**

- remove unsafe cache or scope/encrypt/purge it;
- fail closed on lock;
- remove PHI from lock-screen notifications;
- fix type/build graph and add App CI.

**Core/data**

- live database/grant/RLS/function/trigger/job/storage inventory;
- clean baseline experiment;
- product/domain ownership register;
- one identity/session decision.

**Exit gate:** no known trivial cross-user/tenant path, no fake durable success, and no material public claim known to be false.

### Release 1 — shared platform seam, 1–3 months

- account/person/organization/facility/membership model;
- trusted request context and policy engine;
- private schemas, product runtime roles, repositories;
- canonical command/event contracts;
- transactional outbox/inbox, workers, retry, DLQ, operator replay;
- Uganda country-pack foundation;
- terminology/content/indicator version framework;
- object-storage governance;
- audit/provenance and observability baseline;
- sync protocol and encrypted local-store proof;
- shared accessibility-tested design system;
- contract and tenant-isolation tests.

**Exit gate:** clean environment rebuilds from source; one event crosses all three products with replay; one device command survives restart; tenant/role matrix passes.

### Release 2 — first three-product vertical, 3–9 months

```text
App request
-> OS registration/triage/signed encounter/order
-> Pharm eRx/availability/dispense/stock/payment
-> App instructions/follow-up
-> indicator/audit/interop projections
```

Include:

- MPI and affiliation;
- consent/purpose;
- facility scheduling/OPD;
- signed clinical record;
- medication order and dispense reconciliation;
- stock/cash ledgers and till;
- patient summary and next actions;
- real App and pharmacy offline commands;
- facility edge proof;
- SMS/assisted fallback;
- field pilot, training, support, restore, security, safety and usability evidence.

**Exit gate:** complete episode crosses OS, Pharm, App, Core, audit, offline recovery, and reporting without manual re-entry or unaccounted stock/money.

### Release 3 — Uganda PHC and priority outcomes, 6–18 months

- VHT/CHW household/community workflows;
- ANC, delivery linkage, postnatal/newborn, immunization;
- HIV and TB continuity;
- malaria test/treatment linkage;
- hypertension/diabetes initial care plans;
- diagnostics network and critical-result loop;
- medicine traceability, recall, tracer availability;
- referral/transport closure;
- patient experience/complaints;
- HMIS/DHIS2 production exporter;
- facility/service readiness.

Build programme content with MoH/clinical owners using adopted SMART artifacts and Uganda policies.

### Release 4 — comprehensive facility and financing, 12–30 months

- ADT, inpatient nursing, eMAR, theatre/emergency/ICU selected by need;
- laboratory and imaging maturity;
- rehabilitation, disability, mental health, palliative and ageing;
- revenue cycle, payer integration, claims/remittance/appeal;
- blood, biomedical assets, WASH/facility quality;
- public-health surveillance and emergency operations;
- multi-facility networks and mature edge operations.

### Release 5 — regional federation, 24–60 months

- certified country-pack programme;
- one selected EAC country expansion after formal readiness/gap assessment;
- federated minimum-summary and referral;
- regional surveillance/supply-disruption events;
- partner/developer certification;
- pooled, dedicated, sovereign, and humanitarian deployment operations;
- local implementation/support ecosystem;
- research federation and advanced AI only after governance/data quality.

### Sequencing rule

No phase is “finish one product, then remember the others.” Every release has:

- one OS outcome;
- one Pharm outcome;
- one App outcome;
- shared Core guarantees;
- offline/degradation behaviour;
- country/policy content;
- health and equity measures;
- implementation and support evidence.

---

## 22. Product north stars and scorecard

### 22.1 Synapse OS

**North star:** eligible care episodes completed with required documentation, reconciliation, and safe next action.

Supporting measures:

- registration-to-triage and registration-to-clinician P50/P90;
- encounter documentation completeness;
- duplicate identity rate and unresolved match queue;
- medication reconciliation;
- order-to-result and critical acknowledgement;
- referral acceptance/attendance/closure;
- discharge summary available before/at discharge;
- follow-up completed in window;
- staff documentation time;
- source-to-HMIS concordance.

### 22.2 Synapse Pharm

**North star:** valid medicine demand fulfilled completely, safely, affordably, and traceably.

Supporting measures:

- tracer medicine item-facility days in stock;
- complete prescription-line fill;
- stock-out days;
- physical/system inventory accuracy;
- expiry/wastage as a percentage of receipts;
- batch/product identifier coverage;
- prescribe-to-dispense reconciliation;
- pharmacist interventions and safety actions;
- recall identification/containment;
- antimicrobial stewardship measures;
- patient-reported inability to obtain medicine;
- till, payment, stock, and refund reconciliation.

### 22.3 Synapse App

**North star:** recommended preventive, treatment, referral, and follow-up actions completed in the appropriate window.

Supporting measures:

- appointment attendance;
- referral attendance and closure;
- result acknowledgement and next action;
- ANC/PNC/immunization completion;
- refill/adherence action;
- danger-sign response;
- patient experience and complaint closure;
- low-connectivity success;
- assisted/non-smartphone channel success;
- measures disaggregated by geography, age, sex, disability, and vulnerability where lawful and useful.

### 22.4 Synapse Core/Grid

**North star:** authorized transactions complete without loss, duplicate business effect, or unsafe delay.

Supporting measures:

- locally accepted commands lost: zero;
- duplicate clinical/stock/financial effects: zero;
- sync success and P95 lag;
- conflict/rejection rate and oldest unresolved;
- identity match and duplicate resolution;
- consent/policy enforcement and disclosure audit;
- event delivery and dead-letter age;
- interoperability conformance/acknowledgement;
- data-quality pass and indicator reproducibility;
- restore RPO/RTO;
- security incident detection/containment.

### 22.5 National contribution dashboard

National contribution indicators must always show:

- authoritative source and version;
- SYNAPSE contribution hypothesis;
- external dependencies;
- baseline and target;
- data-quality/confidence;
- whether the metric is directly, jointly, or contextually attributable;
- disaggregation and equity gap;
- no claim that platform adoption alone caused the result.

---

## 23. Definition of Done

A capability is not production merely because a page, table, or handler exists.

### 23.1 Product

- named problem, users, outcome, and owner;
- complete happy, alternate, error, downtime, reversal, and recovery journeys;
- no dead navigation;
- understandable empty/stale/unavailable/conflict states;
- accessibility and language review;
- implementation, training, support, and data-handover plan.

### 23.2 Data and contracts

- owning domain and source of truth;
- schema/contract version;
- validation, constraints, provenance, and lifecycle;
- idempotency and concurrency behaviour;
- retention, correction, reversal, and deletion policy;
- migration/backfill/reconciliation;
- backward compatibility and deprecation.

### 23.3 Security and privacy

- threat model and data-flow review;
- authentication/authorization/tenant/relationship/purpose tests;
- RLS/grant/definer-function evidence;
- audit/disclosure evidence;
- encryption/cache/device/log/notification controls;
- abuse/rate/upload/secret/dependency tests;
- privacy notice and rights workflow match actual processing.

### 23.4 Clinical, pharmacy, and financial safety

- intended use and safety classification;
- hazard analysis and mitigations;
- approved content/terminology/knowledge source;
- human decision and override behaviour;
- wrong-patient/stale/duplicate/downtime tests;
- immutable signature/addendum or ledger/reversal as appropriate;
- reconciliation and exception queues;
- safety owner sign-off and post-release monitoring.

### 23.5 Offline and reliability

- local commit durability;
- restart, replay, duplicate, conflict, long-outage, upgrade, and restore tests;
- visible sync states;
- lease/revocation/content-version policy;
- no lost accepted command or duplicate business effect;
- SLOs, telemetry, alerts, runbooks, and on-call ownership.

### 23.6 Interoperability

- approved profile/mapping/endpoint;
- authentication and data-sharing basis;
- conformance tests;
- acknowledgement/correction/reconciliation;
- retry/dead-letter/replay;
- partner sandbox and operations owner;
- lineage from source to external payload and back.

### 23.7 Evidence

- automated tests;
- field/usability acceptance;
- security/safety/privacy approvals;
- production readiness review;
- measured pilot outcome;
- known limitations and allowed claim text;
- last verification date.

---

## 24. First 90-day programme

### Days 0–15: establish truth and authority

1. Accept or amend the four charters.
2. Name product/domain/safety/privacy/security/interoperability/country-pack owners.
3. Create the capability truth registry.
4. Remove or qualify offline, FHIR, DHIS2, “all routes work,” legal, residency, and AI safety claims.
5. Disable Pharm fake-offline success.
6. Disable or scope unsafe private caching.
7. Publish the first cross-product journey and hazard list.
8. Freeze new screen/module creation.

### Days 15–30: close stop-ship gaps

1. Audit live database objects, grants, RLS, functions, triggers, storage, cron, extensions, and drift.
2. Audit every service-role/admin-client path and every API route.
3. Correct POS money/stock/idempotency/permission behaviour.
4. Make medication-safety failure explicit and safe.
5. Fix App cache purge, lock, push privacy, and build graph.
6. Define safe subscription degradation.
7. Put App in CI and create one smoke test per product.
8. Establish incident, breach, and clinical-safety basics.

### Days 30–60: create the platform seam

1. Approve identity/organization/membership target.
2. Introduce trusted request context.
3. Create private domain and deliberate API schemas.
4. Add product-specific database roles.
5. Create command/event schema packages.
6. Implement transactional outbox, inbox, worker retry and replay.
7. Build one canonical patient-created event across all products.
8. Start Uganda pack with legal, roles, facilities, terminology, reporting, medicines, language, currency, and integrations.
9. Add end-to-end correlation and structured logs.
10. Run clean database creation and drift comparison in CI.

### Days 60–90: prove the first thin vertical

1. App submits an idempotent appointment/community request.
2. OS resolves identity and creates a registered OPD journey.
3. OS signs a basic encounter and medication order.
4. Pharm receives the order and records a verified dispense.
5. App receives medicine instructions and a follow-up task.
6. Outbox events update audit and an indicator projection.
7. One App request and one Pharm transaction work through genuine encrypted local outbox/reconnect.
8. Run cross-tenant, duplicate, restart, conflict, stock, money, notification, and restore tests.
9. Conduct clinician/pharmacist/patient/VHT usability sessions.
10. Decide pilot readiness from evidence, not calendar.

### 90-day deliverables

- accepted ecosystem/product charters;
- authoritative capability register;
- product/data ownership map;
- live database and security evidence pack;
- identity and tenant ADRs;
- Uganda pack `0.1`;
- command/event `v1` contracts;
- outbox/inbox worker slice;
- one thin three-product care path;
- one real offline App command and Pharm command;
- CI gates for OS, Pharm, App, database, and contracts;
- clinical safety/privacy/security registers;
- field-pilot decision.

---

## 25. Decisions that must be explicit

1. Accepted names and charter boundaries for OS, Pharm, App, and Core.
2. Canonical facility route/workspace.
3. Patient App commercial model and data-use prohibition.
4. Pooled, dedicated, sovereign, humanitarian, and edge deployment classes.
5. Identity provider and account/person/membership/session model.
6. Browser Data API versus BFF-only policy.
7. Canonical schemas and domain ownership.
8. Product runtime database roles.
9. Command/event format and durable worker technology.
10. Edge runtime and support model.
11. Offline authority per workflow and controlled-medicine policy.
12. MPI and national/alternative identifier pathway.
13. Consent/lawful-purpose/guardian model.
14. Clinical signing, addendum, correction, and provenance.
15. Money, tax, price, till, ledger, settlement, and accounting model.
16. Product/batch/traceability/controlled-drug knowledge sources.
17. FHIR baseline and Uganda implementation-guide governance.
18. DHIS2/eHMIS and national integration approvals.
19. Country-pack format, signature, certification, and rollback.
20. Data residency and regional federation.
21. Telemedicine operating/regulatory model.
22. AI allowed uses, provider/region, evaluations, and medical-device decisions.
23. Safe SaaS suspension/grace/data handover.
24. Build/partner/integrate choice for each capability family.
25. Pilot population, facilities, success criteria, safety stop rules, and independent evaluation.

---

## 26. What not to do

- Do not add another route because a ministry or investor might expect the label.
- Do not count tables or pages as product maturity.
- Do not prioritize one product so completely that the ecosystem loop never closes.
- Do not force the App into a facility-tenant or patient-per-seat model.
- Do not treat shared database access as interoperability.
- Do not split into dozens of microservices before ownership/contracts exist.
- Do not put one unrestricted database at the centre of Africa.
- Do not hardcode Uganda policy into the universal core.
- Do not claim every health problem is a software problem.
- Do not let AI make final clinical, dispensing, claim, outbreak, or disciplinary decisions.
- Do not fail open on medication safety, device lock, authorization, or financial idempotency.
- Do not acknowledge offline work that has not been durably committed.
- Do not permanently dual-write critical records.
- Do not lock people out of legally/safely required health records because a subscription is overdue.
- Do not expand countries before Uganda product, safety, implementation, and operating evidence is real.

---

## 27. Definition of ecosystem success

The ecosystem is succeeding when:

- a person does not restart their story at every point of care;
- a referral is not complete merely because it was sent;
- a prescription is not complete until access and safe dispensing are known;
- a result is not complete until the responsible person acknowledges and acts;
- community activity connects to facility, pharmacy, diagnostics, and follow-up;
- stock, money, clinical records, consent, and audit survive connectivity loss;
- routine reporting is generated from real service events rather than duplicate manual entry;
- each product can deploy, degrade, and recover independently;
- ministries can change governed country content without rewriting every application;
- countries retain authority over policy, data location, and exchange;
- people without smartphones, literacy, money, or stable connectivity are not designed out;
- equity is measured by who remains excluded, not by aggregate user counts;
- each product is independently useful, while the greatest value appears when all three close the same care journey.

SYNAPSE can become a major health infrastructure company. The route to that scale is not to promise every module now. It is to build a trustworthy health-platform kernel, give each product a precise job, close high-value care journeys, prove offline and safety guarantees, align with public health architecture, and expand through governed country partnerships.

---

## 28. Repository evidence index

### Product definition and plans

- [README.md](../README.md)
- [SYNAPSEOS_MRD.md](../SYNAPSEOS_MRD.md)
- [SYNAPSEOS_ECOSYSTEM_FLOW.md](../SYNAPSEOS_ECOSYSTEM_FLOW.md)
- [SYNAPSE_DASHBOARD_BUILD_PROMPT.md](../SYNAPSE_DASHBOARD_BUILD_PROMPT.md)
- [Complete work plan](./superpowers/plans/2026-07-25-synapse-complete-work-plan.md)
- [Hospital module map](./hospital-module-map.md)
- [Mobile guide](../apps/app/GUIDE.md)
- [Technical master blueprint](./SYNAPSE_MASTER_BLUEPRINT_2026.md)

### Product and workspace structure

- [Root package/workspaces](../package.json)
- [Web package](../apps/web/package.json)
- [Pharmacy package](../apps/pharmacy/package.json)
- [App package](../apps/app/package.json)
- [CI workflow](../.github/workflows/deploy.yml)

### Current offline evidence

- [Pharmacy no-op offline storage](../apps/pharmacy/lib/offlineStorage.ts)
- [Pharmacy resilient-fetch fake success](../apps/pharmacy/lib/api.ts)
- [Pharmacy service worker](../apps/pharmacy/public/sw.js)
- [Pharmacy POS offline path](../apps/pharmacy/app/portal/pos/page.tsx)
- [App cache](../apps/app/lib/cache.ts)
- [App auth/device lock](../apps/app/lib/auth.tsx)
- [Offline queue migration](../supabase/migrations/20260716000001_backfill_missing_baseline_tables.sql)

### Shared coupling and identity

- [Server request context](../packages/auth/src/context.server.ts)
- [Mobile dashboard cross-product reads](../apps/web/src/app/api/mobile/dashboard/route.ts)
- [Database generated types](../packages/db/src/types.ts)
- [Supabase local exposure config](../supabase/config.toml)
- [Web browser Supabase client](../apps/web/src/lib/supabase/client.ts)
- [Pharmacy auth/session adapter](../apps/pharmacy/lib/auth.ts)

### Facades and unfinished integration

- [FHIR capability statement](../apps/web/src/app/fhir/metadata/route.ts)
- [FHIR Observation facade](../apps/web/src/app/fhir/Observation/route.ts)
- [Referral facade](../apps/web/src/app/api/facility/referral/route.ts)
- [Lab instrument facade](../apps/web/src/app/api/lab/instrument-ingest/route.ts)
- [DHIS2 page/actions](../apps/web/src/app/platform/dhis2/page.tsx)
- [Doctor queue placeholder](../apps/web/src/app/doctor/queue/page.tsx)
- [Patient dashboard placeholder](../apps/web/src/app/patient/dashboard/page.tsx)

### Quality, security, and operations

- [Migration check script](../scripts/check-supabase-migrations.mjs)
- [Baseline patient schema](../supabase/migrations/20260511_production_schema.sql)
- [Hospital plan/module seed](../supabase/migrations/20260704120000_hospital_module_registry_seed.sql)
- [Hospital provisioning route](../apps/web/src/app/api/platform/hospitals/route.ts)
- [Parallel encounter route](../apps/web/src/app/api/encounters/route.ts)
- [POS completion route](../apps/pharmacy/app/api/admin/pos/complete-sale/route.ts)
- [POS completion RPC migration](../supabase/migrations/20260725140000_fix_complete_sale_pending_then_complete.sql)
- [Parallel pharmacy report reader](../apps/pharmacy/app/api/admin/reports/route.ts)
- [Pharmacy customer order identity path](../apps/pharmacy/app/api/customer/orders/route.ts)
- [Mobile patient records path](../apps/web/src/app/api/mobile/records/route.ts)
- [Mobile patient-detail path](../apps/web/src/app/api/mobile/patients/%5Bid%5D/route.ts)
- [Web rate limiting](../apps/web/src/lib/rate-limit.ts)
- [Pharmacy rate limiting](../apps/pharmacy/lib/rateLimit.ts)
- [Web middleware](../apps/web/src/middleware.ts)
- [Web security headers](../apps/web/next.config.ts)
- [Pharmacy security headers](../apps/pharmacy/next.config.ts)
- [Historical RLS report](./superpowers/reports/rls-audit-report.md)
- [Historical codebase audit](./audit/codebase-audit.md)

### Official framework

- [WHO SMART Guidelines](https://www.who.int/teams/digital-health-and-innovation/smart-guidelines/)
- [WHO RHIS strategy](https://www.who.int/publications/i/item/9789240087163)
- [WHO primary health care](https://www.who.int/health-topics/primary-health-care)
- [WHO GPW14](https://www.who.int/publications/i/item/B09277)
- [WHO CDISAH](https://www.who.int/publications/i/item/9789240081949)
- [WHO DIIG](https://www.who.int/publications/i/item/9789240010567)
- [WHO Digital Health Platform Handbook](https://www.who.int/publications/i/item/9789240013728)
- [Uganda National Health Compact 2025–2030](https://library.health.go.ug/monitoring-and-evaluation/strategic-plan/uganda-national-health-compact-2025-2030)
- [EAC Digital REACH](https://repository.eac.int/items/a18fd376-78d2-4f6b-ba12-b3cf6f85fab5)
- [Africa CDC Digital Transformation Strategy](https://africacdc.org/download/digital-transformation-strategy/)
- [African Union HIE Guidelines and Standards](https://africacdc.org/download/african-union-health-information-exchange-guidelines-and-standards/)
- [Africa CDC HIEMAT](https://hiemat2.africacdc.org/)
