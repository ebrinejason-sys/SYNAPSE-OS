# SYNAPSE Health Platform
## Whole-system sweep, target architecture, and Uganda-to-global master blueprint

**Snapshot:** 29 July 2026  
**Repository:** `SYNPASE-OS`  
**Purpose:** Product truth, risk register, target architecture, capability map, and staged transformation plan  
**Audience:** Founders, clinical leaders, engineering, implementation teams, regulators, partners, and investors  
**Status:** Technical and evidence annex. The authoritative three-product charter, outcome model, ownership boundaries, cross-product journeys, and balanced sequencing are in [SYNAPSE_ECOSYSTEM_OPERATING_MODEL_2026.md](./SYNAPSE_ECOSYSTEM_OPERATING_MODEL_2026.md). Convert accepted sections of both documents into owned architecture decisions, product specifications, controls, and delivery epics.

> This is an engineering, product, clinical-safety, and regulatory-readiness assessment—not legal or medical advice. Uganda-specific legal interpretations and every country expansion require written confirmation from the relevant regulator and qualified counsel.

---

## 1. The decision in one page

SYNAPSE can become a large healthcare platform, but it is not yet the offline-first, FHIR-connected, sovereign health operating system described in its product documents and marketing.

Today it is best understood as:

- a substantial **online pharmacy SaaS prototype/pilot candidate**;
- a useful but incomplete **SaaS control plane**;
- an early **hospital registration, administration, and OPD foundation**;
- a predominantly read-oriented **mobile companion**;
- a very broad **clinical route and schema catalogue** whose majority is not implemented;
- a collection of **experimental AI features** that are not yet safe to rely on clinically;
- a **single-cloud shared-database monorepo**, not an offline health network.

The largest mistake now would be to keep adding screens and module names. SYNAPSE already has more surface area than verified behaviour. The next phase must turn promises into guarantees.

### The recommended product definition

SYNAPSE should be redefined as:

> **A configurable, offline-capable healthcare platform for care delivery, medicine access, financing, public health, and patient continuity—beginning in Uganda, connected through open standards, and expanded through versioned country packs.**

The customer-facing ecosystem has three equal products:

| Product | Primary job |
|---|---|
| **Synapse OS** | Facility care delivery and operations |
| **Synapse Pharm** | Medicines access, dispensing, retail, inventory, and supply |
| **Synapse App** | Person, caregiver, community, and mobile-workforce continuity |

They share **Synapse Core/Grid**, a healthcare platform kernel for trust, identity, consent, contracts, offline synchronization, interoperability, audit, country packs, analytics, and operations. Core is not a fourth end-user product. See the full [three-product operating model](./SYNAPSE_ECOSYSTEM_OPERATING_MODEL_2026.md).

SYNAPSE should not be one giant universal hospital application or three database-coupled silos. The kernel should provide independently deployable domain modules:

1. Trust, identity, tenancy, consent, and audit.
2. Patient and provider registries.
3. Clinical care and workflow.
4. Diagnostics.
5. Medicines, pharmacy, and supply chain.
6. Revenue, claims, and payments.
7. Patient, caregiver, and community services.
8. Public health and national reporting.
9. Interoperability and partner APIs.
10. Offline/edge synchronization.
11. Governed analytics and AI.
12. Country-specific policy, terminology, language, and integration packs.

### The immediate strategic wedge

Complete one three-product journey before building more horizontal breadth:

1. **Synapse App:** appointment/community request, identity affiliation, consent, navigation, approved summary, medicine instructions, and follow-up.
2. **Synapse OS:** patient identity/consent, registration, queue/triage, signed consultation, orders/results, prescription, invoice/payment, follow-up/referral.
3. **Synapse Pharm:** availability, prescription verification, FEFO dispense, payment/claim evidence, receipt, stock ledger, reconciliation, refill, and adverse-event feedback.
4. **Synapse Core/Grid:** trusted context, commands/events, audit, offline sync, communications, interoperability, and source-based outcome/reporting projections.

That connected journey proves the ecosystem rather than proving one product in isolation.

### Five non-negotiable principles

1. **Truth before breadth.** A route, table, or marketing label is not a feature.
2. **Safety before automation.** Clinical and medication decisions must fail safely and remain under qualified human control.
3. **Offline is a consistency model, not a cache.** It requires local authority, durable commands, reconciliation, conflict policy, and tested recovery.
4. **Interoperability is a contract, not a shared database.** Internal domains and external systems exchange versioned, authorized messages and resources.
5. **Uganda first; country packs thereafter.** Do not hardcode one country's law, currency, registries, terminology, and workflows into a supposedly global core.

---

## 2. What was swept

The assessment covered the active monorepo, its product documents, application routes, API handlers, shared packages, generated database types, SQL migrations, background jobs, offline code, marketing claims, and current Uganda/regional health-system requirements.

Approximate active footprint:

| Area | Observed scale | What it currently contains |
|---|---:|---|
| `apps/web` | 246 pages, 116 route handlers, ~42k lines | Marketing, auth, patient wellness/PHR, hospital shells/admin, OPD, platform control plane, AI endpoints, and mobile backend |
| `apps/pharmacy` | 34 pages, 62 handlers, ~32k lines | Pharmacy portal, POS, inventory, purchasing, orders, customers, reports, staff, and subscriptions |
| `apps/app` | ~20 principal screens, ~6k lines | Expo role-aware mobile views and a small set of mutations |
| Shared packages | auth, database, email, config, UI | Custom sessions/JWTs, capabilities, Supabase clients/types, communication, Uganda constants |
| Database history | 33 migrations plus generated types | Multiple overlapping schema generations and significant drift |
| Active code/documentation | ~101k TypeScript/TSX/SQL lines | A large vision with uneven implementation depth |

The working tree was already heavily modified when this snapshot was reviewed. This report does not assume every local change has been deployed, and remote database policy/state was not treated as provable merely because a local document says it exists.

---

## 3. Product truth: what is real, partial, placeholder, or absent

### Maturity scale

- **Operational candidate:** substantial workflow exists, but still requires security, reliability, regulatory, and field validation.
- **Partial:** meaningful behaviour exists, but the end-to-end journey is incomplete.
- **Prototype:** demonstrates an idea, not a dependable operational workflow.
- **Facade:** a page, schema, flag, catalogue entry, or fixed-success endpoint implies a feature that is not implemented.
- **Absent:** no meaningful implementation found.

### Whole-platform scorecard

| Product/domain | Current maturity | Evidence-based assessment | Target |
|---|---|---|---|
| Pharmacy SaaS | Operational candidate, online-only | Deepest product: POS, inventory, batches, suppliers, purchasing, orders, credit, refunds, reports, users, and billing. Offline checkout is unsafe; financial and authorization issues remain. | First hardened vertical product |
| SaaS control plane | Partial | Tenant/pharmacy/hospital provisioning, applications, plans, feature flags, subscriptions, support, broadcasts, audit screens, and some billing exist. Health telemetry and integration state are often synthetic or incomplete. | Separate global control plane |
| Hospital administration | Partial and duplicated | `/admin`, `/hospital/admin`, and `/os/[slug]` compete as three hospital structures. Configuration and CRUD exist in places; journeys do not converge. | One facility workspace and route hierarchy |
| Patient registry/HIM | Early partial | Registration, search, MRN, and basic chart concepts exist. No enterprise MPI, match confidence, merge/unmerge, guardian authority, record amendments, or disclosure workflow. | Core trust/registry service |
| OPD/triage | Early partial | Some queue and triage APIs/pages exist. Doctor workspace, signed notes, full orders/results, discharge, and follow-up are missing. | Second hardened vertical journey |
| Doctor/encounter workflow | Facade | All `/doctor`, `/encounter`, and `/consults` pages are literal placeholders except a narrow tenant encounter form. | Complete longitudinal encounter module |
| Nursing/IPD | Facade/schema | Beds and handover concepts exist, but all nurse routes are placeholders and ADT/eMAR/care plans are absent. | Inpatient domain module |
| Laboratory | Facade/schema | Tables exist; all lab screens and the instrument-ingest route are placeholders. | LIS with specimen, analyzer, QC, verification, and critical-result workflows |
| Imaging | Facade/schema | Imaging/report concepts and marketing exist; RIS/PACS/DICOM workflows do not. | Imaging module plus DICOM gateway |
| Maternity, paediatrics, theatre, emergency | Facade/schema | Route names and some tables, not care workflows. | Safety-reviewed specialty packs |
| HIV, TB, malaria, mental health, oncology, ICU, dialysis | Facade or absent | Named routes/schemas without operational programmes. | Versioned programme modules |
| Hospital pharmacy/dispensing | Early partial | Queue/inventory/dispense surfaces exist but are not connected to a complete prescribing and medication-safety loop. | Shared medication service and fulfilment contract |
| Revenue cycle | Partial | Internal invoices/payments/claims concepts exist. Complete charge capture, till control, reconciliation, payer exchange, denials, and accounting integration do not. | Immutable revenue ledger and payer adapters |
| Telemedicine | Prototype | Provider lookup, booking, and AI intake exist. Video room is a visual placeholder; regulatory care-model constraints are unresolved. | Regulator-approved service pathways |
| Patient wellness/PHR | Partial/prototype | `/health` reads and wellness tools exist, with some mock data. `/patient` routes are placeholders. | Consent-governed PHR and proxy access |
| Mobile | Partial/read-oriented | Role-aware dashboards and record screens, limited mutations, basic cache. No durable offline database or sync protocol. | Offline-capable role-based client |
| Public health | Monitor/schema | Surveillance report concepts exist. Epidemiology pages are placeholders; DHIS2 does not export. | IDSR/DHIS2/public-health module |
| Referrals | Facade | Tables and routes imply exchange; API/UI are placeholders. | Closed-loop referral and transport workflow |
| FHIR | Facade | CapabilityStatement advertises eight R4 resources; handlers return fixed success JSON. | Profile-driven validated FHIR service |
| AI/copilots | Experimental and disconnected | Several direct Gemini features and an unused reasoning layer. Safety, authorization, provenance, evaluation, and failure behaviour are inadequate. | Governed intelligence plane |
| Communications | Partial | Email, SMS providers, broadcast paths, and Expo push exist. No durable delivery ledger, secure care messaging, or complete consent/preferences. | Omnichannel communication service |
| Offline-first | Not implemented | Pharmacy writes are acknowledged by no-op storage; mobile is a response cache; web has no offline layer. | Edge/local database plus durable sync kernel |
| Country/regional readiness | Not implemented | Uganda details are hardcoded throughout; no localization or country policy engine exists. | Versioned country packs and regional data planes |

### Quantitative signals

- **118 of 246 web pages**—about 48%—literally render “Coming soon.”
- All 10 doctor pages, all 7 encounter pages, all 7 nurse pages, all 7 lab pages, all 5 referral pages, all 11 patient pages, and nearly every department page are placeholders.
- At least **18 route handlers** are fixed-success facades, including eight advertised FHIR resources.
- Generated database types describe **181 tables**; checked-in migrations and generated types overlap only partially. The combined known schema surface is about **221 table names**, more than half of which are not referenced in application code.
- The route tree contains about **300 user-facing screens** and **178 handler files**, but screen count substantially overstates capability.
- No active application imports `@synapse/ui`, despite a shared UI package.
- Hardcoded Uganda-specific currency, time, phone, and locale strings are widespread, while no mature internationalization library or country-pack engine is present.

### Representative evidence

- The product vision promises a connected, FHIR, offline-first system in [SYNAPSEOS_MRD.md](../SYNAPSEOS_MRD.md#L5).
- Pharmacy offline storage explicitly implements no-ops in [offlineStorage.ts](../apps/pharmacy/lib/offlineStorage.ts#L1).
- The POS still prints an offline receipt, promises later sync, and clears the cart in [the POS page](../apps/pharmacy/app/portal/pos/page.tsx#L652).
- The FHIR capability statement advertises resources in [metadata/route.ts](../apps/web/src/app/fhir/metadata/route.ts#L3), while the Patient handler returns only a fixed message in [Patient/[id]/route.ts](../apps/web/src/app/fhir/Patient/%5Bid%5D/route.ts#L3).
- “Export all” only inserts a pending database row in [the DHIS2 page](../apps/web/src/app/platform/dhis2/page.tsx#L26).
- Antenatal care is an eight-line placeholder in [maternity/anc/page.tsx](../apps/web/src/app/dept/maternity/anc/page.tsx#L1); the same pattern appears across core care departments.

---

## 4. Stop-ship and truth-correction register

These are not ordinary backlog items. They can cause clinical, financial, privacy, or trust harm and should block production claims or expansion until controlled.

### P0-1: Offline pharmacy sales can be permanently lost

The most severe product-integrity defect is the pharmacy offline checkout path:

1. `saveOfflineTransaction()` and `queueMutation()` do nothing.
2. The POS treats those calls as durable.
3. It tells the cashier the sale will sync.
4. It prepares a receipt.
5. It clears the cart.
6. No registered service worker or active queue producer was found.

**Impact:** lost sales, incorrect inventory, false receipts, reconciliation failure, possible fraud allegations, and patient medicine traceability gaps.

**Required response:**

- Immediately disable offline checkout or change it to an explicit non-transactional downtime mode.
- Do not print a final fiscal/official receipt until a durable local command is committed.
- Build and chaos-test one real offline POS vertical slice before restoring the claim.

### P0-2: `SECURITY DEFINER` RPCs are not comprehensively locked down

PostgreSQL functions are executable by `PUBLIC` by default unless privileges are revoked. Several high-power functions are defined with `SECURITY DEFINER` but lack a consistent `REVOKE ALL ... FROM PUBLIC` followed by a narrow grant.

The most dangerous example is `complete_pharmacy_sale`: it accepts tenant, cashier, product, price, discount, tax, and other sale inputs, then changes inventory and creates financial records under definer privileges. The checked-in definition in [the latest sale migration](../supabase/migrations/20260725140000_fix_complete_sale_pending_then_complete.sql#L8) contains no caller authorization and no privilege revocation.

Subscription functions also run as definer. Explicitly granting some of them to `service_role` does not remove the default `PUBLIC` privilege. A direct RPC caller may therefore bypass the application route's authorization unless the deployed database has untracked protections.

**Impact:** cross-tenant inventory manipulation, fraudulent sales/payment activation, privilege bypass, and database integrity loss.

**Required response:**

- Inventory every function, owner, `SECURITY DEFINER`, search path, volatility, and current ACL from the live database.
- Revoke `PUBLIC`/`anon`; grant only to the exact role that needs execution.
- Put authorization inside every definer function as defence in depth.
- Prefer private schemas for internal functions and disable unnecessary Data API exposure.
- Add database tests that connect as anonymous, authenticated, cross-tenant, and service roles.

Relevant Supabase guidance: [Securing your Data API](https://supabase.com/docs/guides/api/securing-your-api) and [product security](https://supabase.com/docs/guides/security/product-security).

### P0-3: Current POS discounts are double-counted

The route sums line discounts and passes that sum as `p_discount_total` in [complete-sale/route.ts](../apps/pharmacy/app/api/admin/pos/complete-sale/route.ts#L113). The SQL function independently accumulates the same line discounts, then calculates:

`v_discount = p_discount_total + v_item_discounts`

in [the sale migration](../supabase/migrations/20260725140000_fix_complete_sale_pending_then_complete.sql#L146).

**Impact:** undercharging, incorrect receipts, revenue leakage, incorrect taxes, and ledger/reporting mismatch.

The route also accepts `taxAmount` from the client even though it loads tax settings. Server-side policy must compute all financial totals from authoritative prices, tax rules, approvals, and rounding rules.

### P0-4: The AI health coach has a cross-user authorization flaw

[The health coach route](../apps/web/src/app/api/health/coach/route.ts#L5):

- does not authenticate the caller;
- accepts a caller-supplied `userId`;
- reads that user's prior health conversation through a service-role client;
- sends the history to an external model;
- appends new messages as that user.

**Impact:** health-data disclosure, conversation poisoning, external processor disclosure, and impersonation.

Disable it until server-side identity, tenant/patient authorization, rate limiting, consent, retention, and provider governance are enforced.

### P0-5: Drug-interaction checking fails open

[The interaction route](../apps/web/src/app/api/pharmacy/interactions/route.ts#L34) returns `safe: true` when the AI is not configured and also returns `safe: true` after an exception. It uses a generative model rather than an approved deterministic interaction knowledge base.

**Impact:** a technical failure can be presented as a clinically safe combination.

Required behaviour is **unknown/unavailable**, never safe. Use a validated drug knowledge source, preserve source/version/citations, evaluate local formulary names, and require pharmacist confirmation.

### P0-6: Mobile tenant members can receive overly broad clinical data

The mobile queue API validates token and tenant but does not consistently prove the role/capability needed to view a facility-wide queue. A patient or unrelated tenant member could receive patient names, identifiers, complaints, and queue status.

Every endpoint must derive:

`actor + active membership + tenant/facility + role/capabilities + purpose of use + patient relationship`

from trusted server state—not merely accept a token containing a tenant.

### P0-7: Customer pharmacy authentication is not a secure session boundary

The customer portal has an inconsistent tenant login flow, uses unsalted SHA-256 password hashing, stores only a customer UUID locally, and accepts identity/tenant headers as authorization for order APIs.

Replace it with the platform identity service, memory-hard password hashing or a managed identity provider, signed/revocable sessions, tenant membership, rate limits, MFA options, and server-derived identity.

### P0-8: Authenticated data is placed in unscoped caches

The pharmacy service worker caches authenticated GET APIs and navigations under a global cache name with no user or tenant namespace. Mobile response cache keys are only URL paths, are stored unencrypted in AsyncStorage, and are not cleared on logout.

**Impact:** the next person using a shared device can see a previous user's clinical or operational data.

No authenticated response should enter a generic HTTP cache. Local clinical data needs an encrypted per-user/per-tenant vault with explicit retention and purge rules.

### P0-9: Mobile security fails open

The mobile lock automatically unlocks when biometrics are unavailable and also unlocks after an authentication exception in [auth.tsx](../apps/app/lib/auth.tsx#L156). Cache data remains after logout.

Use a device credential fallback, fail closed for PHI, clear/decrypt inaccessible user data on logout, bind keys to device/user state, and support remote revocation.

### P0-10: Clinical details are exposed in push notifications

[Mobile push code](../packages/auth/src/mobile-push.ts#L175) can put patient labels and chief complaints into lock-screen-visible messages and sends them through Expo.

Default notifications should be discreet: “A queue item requires attention.” The application can reveal details after authentication. Sensitive programmes such as HIV, reproductive health, mental health, and safeguarding require stricter notification policies.

### P0-11: Claims materially exceed implementation

Current marketing says or implies:

- offline-first/full offline operation;
- working FHIR R4 resources;
- scheduled DHIS2 export;
- ASTM/HL7 lab integration;
- PACS/DICOM integration;
- working video care;
- Uganda-only data residency;
- complete data-protection alignment.

These are not supported by the repository snapshot. In particular, internal documents identify the current Supabase project as EU-West-1/Ireland, while the public site says data never leaves Uganda. Supabase's current managed-region list does not include Uganda or an Africa region: [Supabase regions](https://supabase.com/docs/guides/platform/regions).

Replace claims with a capability-status vocabulary:

- Available
- Pilot
- Beta
- In development
- Integration-ready
- Planned

Never label schema, mocks, feature flags, environment-variable fields, or fixed-success routes as available functionality.

### P0-12: Legal and patient-rights surfaces are placeholders

The privacy, DPA, consent-withdrawal, accessibility, and terms pages are not an operational privacy programme. The privacy page explicitly says it is being finalized in [legal/privacy/page.tsx](../apps/web/src/app/legal/privacy/page.tsx#L9).

Before handling real patient data, complete:

- controller/processor notices;
- lawful-basis register;
- patient-access/correction workflow;
- consent and withdrawal;
- disclosure history;
- retention and legal hold;
- breach response;
- subprocessor register;
- cross-border transfer assessment;
- DPO/contact/complaint process;
- child/guardian and sensitive-programme rules.

### P0-13: The checked-in database cannot reconstruct the application contract

The 33 migrations contain 105 `CREATE TABLE` statements, but repetition and demo objects reduce that to only 69 unique public/unqualified table names plus 12 demo names. Generated database types describe 181 public tables. Core runtime pharmacy tables—including `pharmacy_products`, `pharmacy_product_batches`, `pharmacy_pos_sales`, and `pharmacy_pos_sale_items`—are referenced but never created by the checked-in migrations.

The canonical patient shape is also contradictory:

- the production baseline creates `first_name`, `last_name`, and `date_of_birth` in [20260511_production_schema.sql](../supabase/migrations/20260511_production_schema.sql#L71);
- generated types and current registration paths expect `full_name`, `dob`, `hospital_id`, `created_by`, `is_deleted`, and other fields;
- no later checked-in `ALTER TABLE patients` reconciles those contracts.

The migration checker verifies filenames, non-empty content, and SQL-looking text; it does not create a clean database, execute migrations, compare generated types, test policies/functions, or detect remote drift.

**Impact:** clean deployment, disaster recovery, CI, country rollout, and incident reproduction are not trustworthy.

**Required response:** inventory live schema/ACL/policies/functions/jobs/storage, choose the canonical contract, produce a reproducible baseline, rehearse upgrades and restores, regenerate types in CI, and fail builds on drift.

### P0-14: Pharmacy has incompatible sale systems and non-atomic idempotency

Current checkout commits through `complete_pharmacy_sale` into `pharmacy_pos_sales` and `pharmacy_pos_sale_items`. Major dashboard, reporting, transaction history, edit, verification, and refund paths still read `pharmacy_transactions`.

The idempotency lookup occurs before the sale and the key is stored after it; storage errors fail open. Concurrent requests or a timeout between commit and key storage can therefore create duplicate sales.

**Impact:** a real sale can vanish from financial reports and refund workflows, or be applied twice during retry. Stock, till, tax, receipt, and patient-dispense histories cannot be reliably reconciled.

**Required response:** select one append-only canonical sale/stock/payment model, migrate every reader and writer, place command-key claim and business commit in one database transaction, use reversals rather than edits, and test timeout/concurrency/replay behaviour at the database boundary.

### P0-15: Hospital feature gates can deny real care paths while a parallel route bypasses them

Hospital plan shells are intentionally seeded without `plan_features` in [20260704120000_hospital_module_registry_seed.sql](../supabase/migrations/20260704120000_hospital_module_registry_seed.sql#L1). `has_feature()` returns false when no tenant subscription exists, while hospital provisioning creates module/feature rows but not a corresponding `tenant_subscriptions` row.

At the same time, [the parallel encounter endpoint](../apps/web/src/app/api/encounters/route.ts#L7) checks only session and tenant before inserting through the service role. The OS new-encounter screen calls that endpoint, bypassing the capability, subscription, and module decisions used elsewhere.

**Impact:** registration/OPD can fail with 402/403 for a legitimately provisioned hospital, while a weaker endpoint still creates clinical records. Access behaviour depends on route choice rather than one policy.

**Required response:** converge provisioning, subscription, entitlement, module, role, and emergency-access rules into one server-authoritative decision; make every route use it; define healthcare-safe grace/read/export/emergency behaviour; and remove parallel bypasses.

### P0-16: Mobile patient identity is not a valid clinical identity model

Some mobile record queries link patients through `patients.created_by = userId`; appointment queries compare a clinical `patient_id` with a profile/account ID. The repository has no implemented account-to-person-to-facility-patient affiliation or mature MPI that makes those comparisons valid.

In addition, at least one mobile patient-detail endpoint lets an authenticated tenant member retrieve identifiers, contact details, allergies, encounters, and vitals without a sufficient role/capability/patient-relationship decision.

**Impact:** records can be omitted, associated with the wrong person, or exposed facility-wide to an unrelated member.

**Required response:** separate account, person, patient record, identifier, caregiver authority, and organization membership; create verified affiliations; require role, facility, care-team/patient relationship, purpose, consent, and sensitivity checks on every clinical read.

### P0-17: Global browser policy contradicts telehealth and location-dependent claims

The web application sends a global `Permissions-Policy` that disables camera, microphone, and geolocation. That conflicts with teleconsultation, device capture, mapping, and emergency-location experiences advertised elsewhere.

**Impact:** claimed workflows can fail by construction, and a later blanket relaxation could expose media/location capabilities too broadly.

**Required response:** keep restrictive defaults, but define narrowly scoped origin/route permissions for approved workflows; add explicit consent, device-state, denial, and fallback tests; do not market these functions until browser conformance is proven.

---

## 5. Architecture diagnosis

### What the system is now

```text
Marketing + Hospital/Admin + Patient web
                 │
Pharmacy web ────┼──── custom auth/session packages
                 │
Mobile app ── web APIs
                 │
       one shared Supabase/Postgres project
```

This provides code reuse and fast prototyping, but it is not sufficient evidence of interconnection:

- domains read and write shared tables directly;
- browser and server clients use overlapping access paths;
- product routes encode multiple generations of the hospital application;
- durable workers and integration acknowledgements are rare;
- remote schema state is not reproducible from migrations;
- offline nodes do not have a synchronization contract.

### The target shape

Start as a **domain-modular monolith with durable events**, not dozens of microservices. Strict boundaries and contracts matter now; process separation can follow load, regulatory, availability, and team ownership later.

```text
 ┌──────────────────────────────── Experience plane ───────────────────────────────┐
 │ Facility web │ Pharmacy │ Patient/mobile │ CHW │ Partner portals │ Devices      │
 └───────┬───────────┬─────────────┬──────────┬──────────────┬────────────────────┘
         │           │             │          │              │
 ┌───────▼───────────▼─────────────▼──────────▼──────────────▼────────────────────┐
 │ Encrypted local stores + facility LAN edge + signed offline command outboxes   │
 └────────────────────────────────┬───────────────────────────────────────────────┘
                                  │ resumable sync
 ┌────────────────────────────────▼───────────────────────────────────────────────┐
 │ API/BFF + trusted request context + policy enforcement + sync gateway           │
 └────────────────────────────────┬───────────────────────────────────────────────┘
                                  │
 ┌────────────────────────────────▼───────────────────────────────────────────────┐
 │ Domain-modular platform kernel                                                  │
 │ registry │ clinical │ diagnostics │ pharmacy │ revenue │ consent │ public health │
 └───────────────┬──────────────────────────────┬─────────────────────────────────┘
                 │ transactional outbox          │ canonical database/change log
 ┌───────────────▼──────────────────────────────▼─────────────────────────────────┐
 │ Durable workers/event delivery                                                  │
 │ notifications │ FHIR │ DHIS2 │ HL7/ASTM │ DICOM │ payments │ claims │ webhooks │
 └───────────────┬────────────────────────────────────────────────────────────────┘
                 │
 ┌───────────────▼────────────────────────────────────────────────────────────────┐
 │ Uganda HIE/DHIS2/eLMIS/eLIS/eIDSR │ payers │ PSPs │ labs │ partner facilities  │
 └────────────────────────────────────────────────────────────────────────────────┘

 Separate but connected:
 ┌──────────────── Control plane ────────────────┐
 │ tenants │ plans │ config │ support │ rollout │
 └───────────────────────────────────────────────┘
 ┌──────────── Regional clinical data planes ────┐
 │ Uganda │ future country/enterprise partitions │
 └───────────────────────────────────────────────┘
```

### Seven architectural planes

#### 1. Trust plane

- Human and service identity.
- Organizations, facilities, departments, locations, and devices.
- Multi-membership role assignments and capabilities.
- Consent, guardianship, purpose of use, and emergency access.
- Practitioner/facility credential verification and expiry.
- Session/device risk, MFA/passkeys, and key management.

#### 2. Control plane

- Tenant lifecycle.
- Subscription and entitlement.
- Configuration and country-pack assignment.
- Module rollout and feature flags.
- Support, incident, and status management.
- Non-clinical usage/billing telemetry.

The control plane must not become an unrestricted path into all patient records.

#### 3. Clinical/operational data plane

- Patient registry and longitudinal record.
- Encounters, orders, results, medication, care plans, and referrals.
- Facility operations, stock, finance, claims, and workforce.
- Regional or dedicated storage according to tenant policy.

#### 4. Edge/offline plane

- Encrypted device database.
- Facility-local LAN authority when internet is unavailable.
- Command/outbox and change/cursor synchronization.
- Downtime and recovery control.
- Device registration, revocation, expiry, backup, and monitoring.

#### 5. Exchange plane

- FHIR and SMART-style authorization.
- HL7v2/ASTM, DICOM/DICOMweb, DHIS2/IHE ADX.
- National registries and programme systems.
- Payments, insurers, laboratories, suppliers, and partner webhooks.
- Mapping/version/acknowledgement/error queues.

#### 6. Intelligence plane

- Versioned rules, guidelines, terminology, and deterministic calculators.
- Governed AI gateway.
- Retrieval from approved sources.
- Evaluation, human review, model monitoring, and rollback.
- De-identified analytics and research workspaces.

#### 7. Operations/governance plane

- Logs, metrics, traces, audit, and security monitoring.
- Data quality, sync health, integration delivery, and clinical safety.
- Backups, recovery, incident response, change control, and compliance evidence.

---

## 6. Offline-first: the required contract

### What offline-first must mean

For SYNAPSE, offline-first means an authorized worker can safely complete an approved workflow during loss of internet, prove that the data was committed locally, recover after restart, synchronize without duplication, detect conflicts, and reconcile the local and central ledgers.

It does **not** mean:

- showing an old response;
- returning fake HTTP 200;
- caching an authenticated page;
- keeping a cart in localStorage;
- replaying arbitrary HTTP requests;
- assuming last-write-wins;
- treating a service worker as a multi-workstation facility database.

### Required topology by use case

| Use case | Local authority | Why |
|---|---|---|
| Patient mobile | Encrypted SQLite on the device | Personal records, messages, appointments, and safe low-risk mutations |
| CHW/VHT field work | Encrypted SQLite plus bounded field dataset | Long disconnection, household visits, referrals, immunization/outreach |
| Single-counter micro-pharmacy | Encrypted local transactional store; optional desktop wrapper | Sale must survive refresh/restart before receipt |
| Multi-counter pharmacy | Facility LAN edge authority | Counters must share stock, till, and receipt sequence during outage |
| Hospital | Facility LAN edge authority with local clients | Beds, queues, orders, results, dispensing, and billing must coordinate |
| Integration bridge | Managed edge gateway | Instruments and local systems require durable store-and-forward |

### Command envelope

Every offline mutation should be a typed domain command:

```json
{
  "commandId": "uuid",
  "commandType": "pharmacy.sale.complete.v1",
  "schemaVersion": 1,
  "tenantId": "uuid",
  "facilityId": "uuid",
  "deviceId": "uuid",
  "actorId": "uuid",
  "activeRoleAssignmentId": "uuid",
  "aggregateType": "pharmacy_sale",
  "aggregateId": "uuid",
  "baseRevision": 17,
  "capturedAtClient": "ISO-8601",
  "offlineAuthorizationLeaseId": "uuid",
  "payload": {},
  "payloadHash": "sha256",
  "signature": "device-signature"
}
```

The command must be persisted atomically before the UI reports success. The server must atomically:

1. authenticate device and actor;
2. authorize command/purpose/scope;
3. reject revoked or expired offline leases;
4. deduplicate by tenant + command ID + payload hash;
5. validate schema and base revision;
6. execute domain invariants;
7. store the canonical response;
8. append changes and outbox events;
9. return a durable acknowledgement.

### Required sync records

#### Client outbox

- Command ID and type.
- Payload and hash.
- Local commit timestamp.
- Dependency IDs.
- Attempt count and next retry.
- State: local, queued, sending, accepted, conflict, rejected, dead-letter.
- Canonical server response.
- Last error and operator action.

#### Server inbox

- Command ID/tenant/device.
- First-received and completed time.
- Payload hash.
- Authorization decision.
- Result/rejection.
- Canonical response.
- Processing lease and retries.

#### Change feed

- Monotonic tenant/facility sequence.
- Entity and revision.
- Operation and tombstone.
- Minimal authorized projection.
- Schema version.
- Origin command and actor.

#### Device checkpoint

- Last acknowledged sequence.
- Last successful sync.
- Assigned dataset and policy version.
- Device/key status.
- Required re-bootstrap state.

### Conflict policies by domain

| Domain | Policy |
|---|---|
| Signed clinical note | Immutable; correction is a signed addendum, never overwrite |
| Observation/vital/result | Append; mark entered-in-error/amended with provenance |
| Demographics | Compare revisions, field-level merge, or clerical MPI review |
| Consent/restriction | Preserve all versions; the most restrictive valid state wins until reviewed |
| Appointment/bed/queue | Conditional reservation; explicit conflict and reassignment |
| Pharmacy stock | Append-only batch stock ledger; facility authority; bounded offline allocation |
| Sale/payment/claim | Immutable financial entry plus reversal/adjustment; server/provider IDs |
| Product/terminology master | Server-signed version package is authoritative |
| Identity merge | Human-reviewed match; merge and unmerge history retained |
| Deletion | Tombstone plus retention/legal-hold policy; never silent hard-delete |

### High-risk offline rules

- **Money:** calculate from signed price/tax/payer rule packages. Never trust client totals.
- **Stock:** operate against local reservations or allocations; reconcile shortages explicitly.
- **Receipt numbers:** pre-allocate signed number blocks or use globally unique provisional numbers, then reconcile.
- **Controlled medicines:** define whether offline dispensing is allowed, by role and maximum outage.
- **Clinical decision support:** package validated rule/guideline versions; show version and staleness.
- **Consent:** sync restrictive changes urgently; do not broaden access offline.
- **Attachments:** queue encrypted chunks with hashes and resume; never embed large base64 documents in transactional rows.
- **Clock:** record device and server time; never infer clinical sequence only from an untrusted device clock.

### Facility edge

A hospital or multi-counter pharmacy cannot depend on independent browser caches. A facility edge node should:

- serve an authoritative LAN API during internet loss;
- synchronize with the regional data plane;
- host instrument bridges and local print services;
- manage local identity/capability leases;
- monitor power, disk, backup, and sync health;
- encrypt disks and secrets;
- support signed, atomic upgrades and rollback;
- export a downtime/reconciliation report;
- continue safe operation for a defined maximum outage.

### Offline acceptance tests

No workflow is “offline-ready” until it passes:

- network drops before, during, and after commit;
- duplicated, reordered, and delayed messages;
- browser/app/device restart;
- expired session and revoked worker;
- clock drift;
- schema upgrade while offline;
- partial attachment transfer;
- two devices changing the same record;
- multi-counter simultaneous stock/sale;
- server rejection after local acceptance;
- week-long disconnection;
- edge disk-full and power-loss recovery;
- central restore followed by node reconciliation.

---

## 7. Interoperability: from labels to conformance

### Internal interconnection

Domains must not interconnect by directly updating one another's tables. They should use:

- typed commands for requested work;
- versioned domain events for facts;
- query projections for authorized views;
- a transactional outbox and consumer inbox;
- stable identifiers, provenance, correlation, and idempotency.

Example:

```text
Encounter signed
  ├─> medication order created
  ├─> lab order created
  ├─> charge-capture event
  ├─> referral eligibility projection
  ├─> patient-summary update
  └─> public-health rule evaluation
```

Each consumer can retry without changing the committed encounter or duplicating downstream work.

### National architecture alignment

Uganda's digital-health direction calls for enterprise architecture, a health information exchange, facility/client/terminology registries, standards, and integration with national systems. SYNAPSE should enter that ecosystem through the MoH approval/governance process, not position its database as a replacement for national infrastructure.

Primary references:

- [Uganda Health Information and Digital Health Strategic Plan 2020/21–2024/25](https://library.health.go.ug/index.php/health-information-systems/digital-health/uganda-health-information-and-digital-health-strategic)
- [2024 Compendium of National Digital Health Guidelines](https://library.health.go.ug/index.php/health-information-systems/digital-health/compendium-national-digital-health-guidelines)
- [Digital Health Architecture, Standards and Knowledge](https://library.health.go.ug/health-information-systems/digital-health/digital-health-architecture-standards-and-knowledge)
- [Uganda HIE guidelines](https://library.health.go.ug/node/1671)
- [Guidelines for introducing digital health solutions](https://library.health.go.ug/health-information-systems/digital-health/guidelines-introduction-digital-health-solutions-and)
- [EMR implementation guidelines](https://library.health.go.ug/health-information-systems/digital-health/guidelines-implementation-electronic-medical-records)

### OpenHIE-style components

SYNAPSE should integrate with or provide deployable adapters for:

- Client/Master Patient Index.
- Health-worker/provider registry.
- Facility/location registry.
- Terminology service.
- Shared health record or summary exchange.
- Interoperability layer/API gateway.
- Aggregate data service and DHIS2.
- Identity/consent/authorization.
- Audit and provenance.

### FHIR service requirements

Choose and declare one baseline—likely FHIR R4/4B subject to MoH confirmation—and publish:

- implementation guide and Uganda profiles;
- extensions and value sets;
- CapabilityStatement that matches actual behaviour;
- resource examples and test data;
- search parameter support;
- `_history`, version IDs, ETags, conditional operations;
- Bundles/transactions where supported;
- `OperationOutcome` errors;
- `application/fhir+json`;
- provenance, consent, and audit;
- authorization scopes and purpose of use;
- rate limits, pagination, bulk/export policy;
- terminology validation;
- conformance tests in CI.

Priority resources:

- Patient, RelatedPerson, Practitioner, PractitionerRole, Organization, Location.
- Encounter, EpisodeOfCare, Appointment, Schedule, Slot.
- Observation, Condition, AllergyIntolerance, Procedure.
- ServiceRequest, Specimen, DiagnosticReport, ImagingStudy.
- Medication, MedicationRequest, MedicationDispense, MedicationAdministration.
- CarePlan, Goal, Task, Communication, DocumentReference, Composition.
- Consent, Provenance, AuditEvent.
- Coverage, Claim, ClaimResponse, Invoice where the selected implementation guide supports them.
- Immunization, AdverseEvent, SupplyDelivery.

FHIR is an external interoperability projection. The internal data model may be optimized for transactional care, provided mapping is deterministic, versioned, and reversible enough for provenance.

### DHIS2/eHMIS

A real exporter needs:

1. versioned indicator and data-element mappings;
2. facility/org-unit mapping;
3. reporting period and cutoff logic;
4. source record lineage and data-quality checks;
5. aggregate/event payload generation;
6. authorized submission;
7. remote acknowledgement and import summary;
8. retry/backoff/dead-letter handling;
9. correction/resubmission;
10. reconciliation dashboard;
11. immutable export evidence.

The UI must distinguish **prepared**, **validated**, **submitted**, **accepted**, **partially accepted**, and **rejected**. “Pending row exists” is not an export.

### Laboratories and devices

- HL7 v2.x and ASTM bridges at facility edge.
- Instrument identity, certificates, mTLS, allowlists, and replay protection.
- Order/specimen correlation.
- Unit/reference-range and terminology mapping.
- QC/EQA state and analyzer maintenance.
- Result verification and amendment.
- Critical-result acknowledgement/escalation.
- Raw-message retention with access controls.
- IEEE 11073 where appropriate for devices.

### Imaging

- DICOM/DICOMweb.
- Modality worklist.
- Storage commitment.
- Study/series/instance identity.
- Viewer launch and authorization.
- Report linkage and amendments.
- Image lifecycle/retention and regional storage.
- Published conformance statement.

[DICOM's official standard site](https://www.dicomstandard.org/) should be treated as the authoritative baseline.

### Medicines and supply-chain exchange

- Stable product/master identifiers.
- GS1 GTIN/GLN and, where required, serial/batch/expiry.
- EPCIS-style traceability events where nationally adopted.
- NDA product/source/licence mapping.
- eLMIS/NMS/JMS/supplier adapters.
- Recall, quarantine, return, disposal, and pharmacovigilance.

Uganda's [National Pharmaceutical Traceability Strategy](https://library.health.go.ug/node/1686) should inform the medicine identity and movement model.

### Regional exchange

Do not create one central African patient database. Begin with patient-authorized, signed minimum summaries based on the International Patient Summary, scoped referrals, and event acknowledgements.

Regional design should align with:

- [EAC Digital REACH Strategy](https://repository.eac.int/items/a18fd376-78d2-4f6b-ba12-b3cf6f85fab5)
- [AU Data Policy Framework](https://au.int/en/documents/20220728/au-data-policy-framework)
- [Africa CDC Digital Transformation Strategy](https://africacdc.org/download/digital-transformation-strategy/)
- [Africa CDC HIE Guidelines and Standards](https://africacdc.org/download/african-union-health-information-exchange-guidelines-and-standards/)

---

## 8. Canonical data architecture

### Current weakness

The repository has multiple sources of schema truth:

- generated live-database types;
- checked-in migrations;
- application string references;
- an obsolete Prisma schema;
- design documents that acknowledge production drift.

Observed examples of overlapping concepts include:

- `profiles`, `patients`, and `patient_profiles`;
- `vitals`, `app_vitals`, `patient_vitals`, and `device_readings`;
- `invoices`, `billing_invoices`, and `patient_billing`;
- `products`, `pharmacy_products`, `drug_inventory`, and `inventory_items`;
- multiple audit, notification, order, and transaction structures.

This blocks reproducible testing, disaster recovery, edge deployment, sync schema versioning, and regional rollout.

### Required schema programme

1. Export and review the complete live schema, policies, grants, functions, triggers, extensions, storage rules, and scheduled jobs.
2. Classify every object as keep, migrate, merge, archive, or delete.
3. Select canonical identifiers and ownership for every bounded context.
4. Build a new reproducible baseline plus forward-only migrations.
5. Prove a clean local reset reproduces the expected schema and seed.
6. Regenerate types and fail CI on drift.
7. Stop using untyped `as any` database calls except inside a narrow reviewed adapter.
8. Retire the unused Prisma schema after any needed history is captured.

### Proposed logical schemas

| Schema/context | Ownership |
|---|---|
| `iam` | accounts, identities, sessions, devices, MFA, credentials |
| `org` | organizations, facilities, departments, locations, memberships |
| `registry` | persons, patients, identifiers, match candidates, merge history, guardians |
| `consent` | consent directives, restrictions, purpose, access grants, disclosures |
| `clinical` | encounters, problems, allergies, observations, notes, care plans, procedures |
| `orders` | service/medication orders, tasks, status transitions |
| `diagnostics` | specimens, results, reports, imaging metadata, QC |
| `medication` | formulary, prescriptions, dispensing, administration, reconciliation |
| `pharmacy` | catalog, batch ledger, purchasing, stock, POS, controlled registers |
| `revenue` | charge ledger, invoices, payments, refunds, claims, reconciliation |
| `public_health` | case reports, programme indicators, surveillance, exports |
| `interop` | mappings, external IDs, messages, acknowledgements, subscriptions |
| `workflow` | forms, definitions, tasks, rules, versions |
| `communication` | preferences, messages, delivery attempts, receipts |
| `audit` | immutable security/clinical/financial audit and provenance |
| `platform` | tenants, plans, entitlements, rollout, support |
| `sync` | devices, commands, inbox/outbox, changes, checkpoints, conflicts |
| `private` | internal functions, secrets references, maintenance state |

Logical schemas do not require immediate physical isolation, but they establish ownership and stop arbitrary cross-domain writes.

### Clinical record rules

- Use structured coded concepts plus human-readable text.
- Preserve author, facility, encounter, source, timestamps, and version.
- Signed clinical documents are immutable.
- Corrections are linked addenda with reason and author.
- “Entered in error” is a state, not deletion.
- Preserve original imported value and mapping provenance.
- Separate clinical event time, recorded time, and last processing time.
- Do not overwrite a value simply because a newer device clock appears later.
- Apply record-class retention, legal hold, and disclosure rules.

### Ledgers

Use append-only ledgers for:

- stock movement;
- till/cash shift;
- payment/refund/adjustment;
- claim submission/response;
- controlled medicines;
- consent versions/disclosures;
- security and break-glass access.

Balances are projections of ledger entries, not fields freely edited by clients.

### Object and media storage

Identity documents, licences, scans, reports, images, and large attachments should use governed object storage:

- per-tenant/region placement;
- content hash and metadata;
- encryption and key policy;
- malware/file-type scanning;
- resumable upload;
- signed, short-lived access;
- thumbnail/redaction pipeline;
- retention/legal hold;
- access/disclosure audit.

Do not store unbounded base64 data URLs in relational rows.

---

## 9. Identity, tenancy, authorization, and consent

### Current weaknesses

- Role taxonomies differ across shared constants, database constraints, capability seed data, mobile routing, and pharmacy aliases.
- A single `profiles.role + tenant_id` cannot model clinicians working across facilities, locums, partner labs, platform support, community workers, patients, and temporary access.
- Custom JWT/session logic coexists with Supabase concepts and direct browser database access.
- Service-role clients appear across request paths, making every missing filter a possible cross-tenant breach.
- Facility types and post-login routing disagree.

### Target identity model

```text
Account
  ├─ Person identity
  ├─ Credentials / MFA / passkeys
  ├─ Registered devices and keys
  └─ Memberships
       ├─ Organization/facility/location
       ├─ Role assignment
       ├─ Capability constraints
       ├─ Validity period
       ├─ Credential/scope evidence
       └─ Delegation/supervision
```

Separate:

- **person** from **login account**;
- **patient record** from **consumer account**;
- **practitioner credential** from **system role**;
- **organization membership** from **global identity**;
- **platform administration** from **clinical access**.

### Request context

Every server request should establish one immutable context:

```text
request/correlation ID
actor account and person
active organization/facility/location
active role assignment and capabilities
tenant home region
device/session assurance
patient relationship
purpose of use
consent/restriction state
break-glass state
```

All repositories and commands receive this context. Client-supplied tenant, actor, cashier, clinician, or patient identifiers must not override it.

### Authorization model

Use RBAC for broad job functions and ABAC for context:

- role/capability;
- facility/department/location;
- patient relationship/care team;
- purpose of use;
- consent/sensitivity;
- time/shift;
- credential/scope;
- device assurance;
- emergency/break-glass.

High-risk examples:

- A cashier can create a sale but cannot choose a different cashier identity.
- A pharmacist can verify/dispense within a licensed facility and scope.
- A platform support engineer cannot browse patient charts by default.
- A clinician from Facility A needs a consent/referral/access grant for Facility B.
- HIV, mental-health, reproductive, safeguarding, and research data may require segmented access.

### Break glass

Break-glass access needs:

- explicit reason and patient;
- strong re-authentication;
- time-bounded access;
- limited data and action scope;
- prominent UI state;
- immutable audit;
- automatic privacy/security review;
- patient notification where appropriate and lawful.

### Consent and guardianship

Build versioned consent directives:

- care and treatment;
- data sharing/referral;
- telemedicine;
- research/secondary use;
- communications;
- device/wearable data;
- proxy/caregiver;
- sensitive programme restrictions.

Capture:

- information shown and language;
- legal basis and consent type;
- person/guardian/representative authority;
- witness/clinician where required;
- time, place, channel, and signature evidence;
- scope, expiry, withdrawal, and supersession.

Consent does not replace other lawful bases for necessary care and statutory reporting. The system needs a documented lawful-basis matrix per data flow.

---

## 10. Security, privacy, resilience, and trust

### Security architecture

- Zero-trust service and user access.
- Least privilege at UI, API, database, queue, and storage layers.
- MFA/passkeys for staff and administrators.
- Device registration and risk policy.
- Short-lived access tokens and rotating refresh/session credentials.
- Key management service/HSM-backed secrets where feasible.
- Encryption in transit and at rest; field/column encryption for the most sensitive classes.
- Network separation for edge/instrument traffic.
- Signed webhooks, mTLS where appropriate, and replay protection.
- Secure headers/CSP without a fake success endpoint.
- Tenant-scoped rate limiting and abuse detection.
- Central authorization tests and database policy tests.

### Database controls

- Private schemas for internal tables/functions.
- Minimize exposed Data API schemas.
- RLS on every exposed tenant table, with tests.
- Explicit function ACLs; no implicit `PUBLIC` execution.
- Fixed `search_path` for definer functions.
- Do not expose service-role keys to clients.
- Query through typed repositories/command handlers.
- Separate migration owner from runtime roles.
- Audit grants and policies from the live database in CI/CD.

Supabase's [Data API security guide](https://supabase.com/docs/guides/api/securing-your-api) should be implemented as a verified control set, not assumed from “RLS enabled.”

### Privacy programme

Required operational capabilities:

- data inventory and processing register;
- controller/joint-controller/processor mapping;
- lawful basis and purpose register;
- versioned privacy notices;
- data-subject access and correction;
- lawful erasure/de-identification;
- consent withdrawal;
- disclosure accounting;
- retention and legal hold;
- subprocessor and cross-border transfer register;
- DPIAs;
- breach and complaint management;
- privacy-preserving support/admin access;
- de-identification and research approvals;
- verifiable export and destruction.

Uganda's health/medical records are special personal data under the [Data Protection and Privacy Act](https://ulii.org/en/akn/ug/act/2019/9/eng%402019-05-03). PDPO guidance also requires organizational governance, registration/renewal, a DPO, processor management, and compliance reporting: [PDPO organizational obligations](https://pdpo.go.ug/information-center/organisation).

### Data residency

Do not equate “sovereign” with a marketing sentence. Define deployment classes:

| Class | Intended use |
|---|---|
| Shared Uganda-approved regional SaaS | Small facilities, where written legal/contractual approval permits |
| Dedicated tenant data plane | Large hospital/group with isolation requirements |
| Government/private cloud deployment | National or contractually sovereign environments |
| Facility edge with regional sync | Intermittent connectivity and continuity |
| Research enclave | Approved de-identified/pseudonymized datasets |

Each tenant needs a home region, cross-border transfer basis, backup region, subprocessor list, and data-flow map. Supabase offers [self-hosting guidance](https://supabase.com/docs/guides/self-hosting); self-hosting changes the operational burden and must include upgrades, monitoring, backup, security, and incident response.

### Audit

Audit must not fail open for regulated events. Capture:

- actor and impersonator;
- tenant/facility/patient;
- purpose and break-glass;
- action and result;
- before/after hash or relevant fields;
- request/device/IP/session;
- source application/service;
- timestamp and correlation;
- export/disclosure recipient;
- integration delivery/acknowledgement.

Use append-only storage, restricted access, integrity chaining or equivalent tamper evidence, retention policy, and alerting.

### Secure software delivery

- Threat modelling and clinical hazard analysis.
- Mandatory review for migrations, auth, money, medication, and clinical rules.
- SAST, dependency, licence, secret, container, and IaC scanning.
- SBOM and signed build provenance.
- Environment promotion and migration rehearsal.
- Feature flags with owner, expiry, and rollback.
- No production-only schema changes.
- Automated tenant-isolation and authorization tests.
- Penetration testing before pilot and after major architecture changes.
- Coordinated vulnerability disclosure.

### Resilience

Define service tiers and measured objectives:

- RTO/RPO by clinical, financial, audit, and analytics data.
- PITR and independent encrypted backup.
- Restore tests, not backup existence.
- Regional and facility-edge recovery.
- Downtime procedures and paper/QR continuity.
- Queue backlog and sync-lag alerts.
- Capacity and load testing.
- Incident command, clinical safety escalation, and post-incident learning.

Supabase documents [point-in-time recovery](https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery), but SYNAPSE still needs independent recovery policy, evidence, and drills.

---

## 11. Clinical safety and AI governance

### Present AI risk

Current AI features directly prompt a general model for:

- differential diagnosis;
- drug interaction assessment;
- health coaching;
- tele-triage;
- diet analysis;
- document and face-quality “verification”;
- demo clinical reasoning.

Important weaknesses include:

- no shared model gateway or approved-use registry;
- inconsistent/no authentication;
- caller-supplied tenant/patient identifiers;
- no robust structured-output schema validation;
- no prompt-injection/content boundary;
- no source/citation validation;
- no versioned guideline retrieval;
- no local clinical evaluation;
- no subgroup/bias analysis;
- no abstention/uncertainty contract;
- unsafe fail-open behaviour;
- no adverse-event or drift monitoring;
- direct PHI/identity disclosure to an external provider without a complete governance record;
- product copy that can imply stronger clinical grounding than the implementation provides.

### Governing principle

AI may assist a qualified person; it must not silently become the source of clinical truth, medication safety, practitioner licensing, identity verification, or legal consent.

### Intelligence stack

```text
Deterministic safety rules and calculators
          │
Versioned terminology/guideline knowledge service
          │
Retrieval and evidence package
          │
Governed model gateway
          │
Schema validation + policy checks + uncertainty
          │
Human confirmation / documented action
          │
Outcome, feedback, incident, and drift monitoring
```

### AI use-class register

Every AI use case needs:

- intended user and intended use;
- excluded uses and contraindications;
- clinical risk class;
- model/provider/version/region;
- input data categories and minimization;
- legal basis, consent, and processor terms;
- prompt/system/rule version;
- evidence source versions;
- output schema and allowed actions;
- human-review requirement;
- evaluation dataset and metrics;
- Uganda/local subgroup performance;
- monitoring and alert thresholds;
- rollback/kill switch;
- retention and audit;
- regulator/medical-device determination.

### Required safety behaviour

- Return **unknown/unavailable** when evidence or service is unavailable.
- Never translate infrastructure failure into “safe.”
- Show evidence version, limitations, and uncertainty.
- Require clinician/pharmacist confirmation for consequential action.
- Keep AI suggestions separate from signed clinician documentation until accepted.
- Preserve the original suggestion and final human decision.
- Apply deterministic red-flag checks independently of the LLM.
- Prevent prompts or record text from changing system instructions.
- Do not train on care data without an approved, explicit secondary-use pathway.
- Maintain local performance and adverse-event surveillance.

### SaMD/regulated software

Diagnostic, triage, dosing, interpretation, and autonomous recommendation functions may be medical-device software. Obtain a written classification and maintain a safety lifecycle. Relevant engineering targets may include IEC 62304, ISO 14971, IEC 81001-5-1, ISO 82304-1, and ISO 13485 where applicable.

Uganda NDA provides a starting point for determining whether software is a medical device: [Is it a medical device?](https://www.nda.or.ug/is-it-a-medical-device/) and [device classification](https://www.nda.or.ug/classify-your-medical-device/).

### Credential and identity verification

The current image checks only ask a model whether an image resembles a credential or contains a face. That is not:

- document authenticity verification;
- liveness;
- face-to-document matching;
- professional-registry verification;
- practising-licence validation;
- scope-of-practice verification.

Build a formal verification workflow with regulator registry integration or manual primary-source review, evidence provenance, expiry, re-verification, and appeal.

---

## 12. Healthcare problem map

Software cannot solve every health problem by itself. It can reduce information, coordination, workflow, access, supply, financing, and accountability failures while enabling clinicians, communities, facilities, government, payers, and partners.

### Problem-to-platform map

| Health-system problem | Platform response | Outcome to measure |
|---|---|---|
| Patients lack continuous records | MPI, longitudinal record, portable summary, referral exchange, patient access | duplicate records, history availability, referral completion |
| Rural/intermittent connectivity | encrypted offline clients, facility edge, store-and-forward | lost transactions, outage continuity, sync lag |
| Long waits and missed care | appointments, queue, triage, tasking, reminders, defaulter tracing | wait time, no-show rate, time to triage/treatment |
| Workforce scarcity | role-based workflow, protocols, task shifting, remote supervision, safe CDS | clinician time, protocol adherence, escalation time |
| Medicine stock-outs/expiry/leakage | batch ledger, FEFO, demand planning, procurement, traceability, audit | availability, stock variance, expiry loss |
| Unsafe prescribing/dispensing | medication reconciliation, deterministic interaction/allergy checks, pharmacist verification | prevented errors, verification compliance |
| Fragmented diagnostics | e-orders, specimen chain, instrument interfaces, critical alerts, result return | turnaround time, lost specimens, critical acknowledgement |
| Maternal/newborn mortality | ANC, risk tracking, partograph, referral, blood/oxygen readiness, postnatal follow-up | completion, referral delay, adverse outcomes |
| HIV/TB/malaria and NCD continuity | programme workflows, cohorts, adherence, labs, follow-up, community linkage | retention, viral suppression, treatment completion, control |
| Unaffordable/unpredictable care | transparent service catalog, estimates, claims/preauth, mobile money, payment plans | denial rate, catastrophic surprise bills, reconciliation |
| Weak public-health visibility | versioned case definitions, IDSR alerts, lab linkage, DHIS2 reporting | reporting timeliness/completeness, detection-to-response |
| Fraud and poor accountability | immutable ledgers, separation of duties, stock/finance reconciliation, audit analytics | unexplained variance, duplicate claims, closure time |
| Patient exclusion | languages, accessibility, proxy/guardian, SMS/USSD/IVR, low-literacy design | completion by language/disability/device segment |
| Poor quality improvement | outcomes, process measures, incident reporting, guidelines, audit feedback | safety events, guideline adherence, improvement cycles |
| Weak research evidence | governed de-identified datasets, lineage, approvals, registries | approved studies, data quality, time to evidence |

### Uganda priority framing

The roadmap should align with current national priorities: stronger primary/community care, RMNCAH, malaria/HIV/TB, NCDs and injuries, workforce and equipment, digital records, medicine accountability, quality, and public-private coordination. See the MoH [Annual Health Sector Performance Report FY 2023/24](https://library.health.go.ug/sites/default/files/resources/Annual%20Health%20Sector%20Performance%20Report%20%20FY%202023_24.pdf) and [Uganda National Health Compact 2025–2030](https://library.health.go.ug/monitoring-and-evaluation/strategic-plan/uganda-national-health-compact-2025-2030).

---

## 13. Complete target capability universe

This is the proposed product universe, not a promise that every module should be built by SYNAPSE or built immediately. Each capability must pass a build/partner/integrate decision based on health impact, regulatory scope, economics, local alternatives, and platform leverage.

### 13.1 SYNAPSE Core and Trust

#### Organization and facility

- Health-system/group, organization, facility, branch, department, ward, room, bed, service point, and geographic location.
- Facility types and levels configurable per country.
- Facility licence, accreditation, ownership, services, opening hours, catchment, contacts, and geospatial identity.
- Multi-facility groups, referral networks, franchises, and public/private/faith-based/NGO models.
- Facility directory and service availability.
- Tenant lifecycle, sandbox, pilot, production, suspension, archive, and data handover.

#### Identity and access

- Staff, patient, caregiver, supplier, payer, partner, and service accounts.
- Passwordless/passkey, password, OTP, federation, enterprise SSO, and government ID adapters.
- MFA and recovery.
- Device registration and trust.
- Memberships, contextual roles, capabilities, scope, supervision, delegation, and expiry.
- Practitioner credential, annual practising licence, speciality, facility affiliation, and scope.
- Break-glass and emergency access.
- Access review and certification.

#### Patient identity/MPI

- Multiple identifiers: local MRN, national ID where lawful, insurer ID, programme ID, maternal/newborn link, refugee/alternate IDs.
- No requirement that a patient possess a national ID.
- Probabilistic/deterministic matching.
- Match confidence and clerical review.
- Duplicate prevention.
- Merge/unmerge and survivorship.
- Newborn/unknown/emergency identity.
- Deceased identity.
- Cross-facility record location and patient-authorized linkage.

#### Consent, privacy, and rights

- Consent and restriction directives.
- Guardian, proxy, caregiver, representative, and delegated access.
- Patient access, correction, restriction, export, and complaint requests.
- Disclosure accounting.
- Sensitive-programme segmentation.
- Retention, legal hold, de-identification, and destruction.
- Privacy notices, policy versions, DPIAs, data-sharing agreements, and processing register.

#### Platform services

- Terminology, value sets, mappings, and units.
- Configurable forms and questionnaires.
- Workflow, task, rules, and care-path definitions.
- Documents, signatures, addenda, and templates.
- Notifications, preferences, delivery receipts, and escalation.
- Search, audit, provenance, timeline, and activity feed.
- Feature entitlements and rollout.
- Support, implementation, training, and knowledge base.
- Import, export, master-data package, and migration tools.

### 13.2 Facility EHR and care delivery

#### Access and scheduling

- Service directory.
- Provider schedules, slots, waitlists, overbooking policy, and resource scheduling.
- Walk-in, appointment, referral, outreach, and emergency arrival.
- Check-in, queue tokens, priority, estimated wait, and patient flow.
- SMS/USSD/call-centre booking and reminders.
- Appointment confirmation, reschedule, cancellation, no-show, and recall.

#### Registration and triage

- Patient search/match before creation.
- Demographics, contacts, address/location, next of kin, guardian, language, accessibility, and payer.
- Consent/privacy capture.
- Arrival reason and source.
- Vitals, pain, triage category, red flags, infection risk, pregnancy, and safeguarding.
- Structured screening tools and escalation.
- Queue handoff and time stamps.

#### Encounter

- History, review of systems, examination, problems, allergies, medication reconciliation, immunization, social/family history.
- Clinical notes and configurable specialty templates.
- Diagnoses with certainty/status and coding.
- Orders, results, procedures, medication, care plans, education, and follow-up.
- Clinical tasks, consultations, handover, and multidisciplinary review.
- Signed/locked documentation, corrections, addenda, and co-signature.
- Disposition: discharge, admit, refer, observe, transfer, deceased, left before completion.
- Patient summary and after-visit instructions.

#### Orders and results

- Order sets and favourites.
- Laboratory, imaging, procedure, medication, referral, nutrition, therapy, and device orders.
- Priority, indication, specimen/site, scheduling, authorization, and status.
- Duplicate/contraindication checks.
- Results inbox, abnormal/critical flags, acknowledgement, review, and patient release policy.
- Amendments and corrected reports.

#### Referral and care coordination

- Referral reason, urgency, target service/facility/provider, consent, and minimum dataset.
- Facility/service discovery and capacity signal.
- Acceptance, rejection, redirection, appointment, transport, and escalation.
- Referral document/summary and secure communication.
- Closed-loop result, discharge, counter-referral, and outcome.
- Access-grant scope/expiry and disclosure history.
- Cross-border portable summary.

#### Health information management

- Chart completion/deficiency.
- Coding, abstracting, indexing, and quality review.
- Document scanning/import.
- Disclosure and medico-legal request.
- Record amendment.
- Retention and archive.
- Birth/death notification and certification support, subject to authority.

### 13.3 Emergency, ambulance, inpatient, and critical care

#### Emergency department

- Pre-arrival alert and ambulance handover.
- Acuity/triage, resuscitation, emergency orders, time-critical pathways, and observation.
- Trauma, sepsis, stroke, acute coronary, poisoning, obstetric, paediatric, and mental-health emergency pathways.
- Mass-casualty mode.
- Transfer/referral and disposition.

#### Ambulance and prehospital

- Dispatch, crew, vehicle, location, incident, response times.
- Scene assessment, interventions, medications, vitals, handover.
- Destination selection and pre-notification.
- Offline field mode.
- Fleet, maintenance, oxygen, equipment, and consumables.

#### ADT and bed management

- Admission request and approval.
- Bed/ward/service assignment.
- Transfer and temporary leave.
- Isolation/cohorting.
- Occupancy/census and predicted discharge.
- Discharge readiness and summary.
- Bed cleaning/turnaround.

#### Nursing

- Admission assessment.
- Care plan and goals.
- Observation/vital schedules and early warning.
- Fluid balance, intake/output, lines/drains, wounds, pressure-injury risk.
- Medication administration and bedside checks.
- Procedures, tasks, rounds, handover, escalation, and discharge education.
- Staffing/assignment and workload.

#### Medication administration

- Validated medication order.
- Schedule and dose.
- Five/right-patient safety checks and barcode where available.
- Hold, refuse, omit, late, waste, partial dose, and reason.
- Controlled-drug witnessing.
- Adverse reaction and medication error.
- Reconciliation at transitions.

#### Theatre and anaesthesia

- Surgical request, indication, consent, pre-op assessment, and clearance.
- Theatre list, team, equipment, blood, implant, and stock readiness.
- WHO surgical safety checklist.
- Anaesthetic chart, medications, fluids, airway, monitoring, and events.
- Procedure/operative note, specimen, implant/lot tracking.
- Recovery/PACU and post-op orders.

#### ICU/NICU

- Admission/acuity.
- High-frequency observation and device feeds.
- Ventilation, infusions, fluid balance, scores, and organ support.
- Daily goals, rounds, lines, infection, and nutrition.
- Alarm/event review.
- Step-down/discharge and outcome.

#### Blood/transfusion

- Donor/blood-source integration where appropriate.
- Request, sample, group/crossmatch, reservation, issue, bedside verification.
- Product/lot/expiry and cold-chain.
- Transfusion observations, reaction, investigation, and haemovigilance.

### 13.4 Maternal, newborn, child, and adolescent health

#### ANC

- Pregnancy episode and estimated gestation.
- Obstetric history and risk.
- Routine assessments, labs, prevention, immunization, supplements, and counselling.
- Birth plan, danger signs, referral, and visit schedule.
- Missed-visit tracing.

#### Labour and delivery

- Admission, labour assessment, fetal/maternal monitoring.
- Digital partograph aligned to approved guidance.
- Interventions, medications, fluids, procedures, and escalation.
- Delivery details, attendant, mode, complications, blood loss, and outcome.
- Mother-newborn linkage.

#### Postnatal/newborn

- Maternal and newborn checks.
- Apgar/resuscitation, weight, gestation, feeding, prophylaxis, screening, and immunization.
- Prematurity/low-birth-weight follow-up.
- Danger signs and referral.
- Birth notification.

#### Paediatrics

- Age/weight/gestation-safe dosing.
- Growth charts and nutrition.
- Developmental screening.
- Integrated childhood illness pathways where approved.
- Guardian/assent and safeguarding.

#### Immunization

- Schedule by country/version.
- Eligibility, contraindication, dose, site, lot, expiry, vaccinator.
- Defaulter tracing and outreach.
- Stock/cold-chain linkage.
- AEFI detection/reporting.
- Certificate/portable history.

#### Adolescent care

- Age/domain-specific consent.
- Privacy and guardian policy.
- Sexual/reproductive, HIV, mental-health, nutrition, substance-use, and violence/safeguarding pathways.
- Discreet communications.

### 13.5 Priority programmes and specialties

Each programme must be a versioned care/workflow pack, not a separate patient silo.

#### HIV

- Testing mode and consent.
- Linkage/enrolment.
- ART regimen, refill, adherence, viral load, differentiated service delivery.
- TB screening and prevention.
- PMTCT/mother-infant pair.
- Disclosure restrictions, counselling, and disclosure accounting.
- Cohort/programme reporting.

#### TB

- Screening, diagnostic pathway, specimen/lab.
- Drug-susceptible/resistant regimen.
- Treatment support, contact tracing, adherence, and outcomes.
- Public-health reporting.

#### Malaria

- Case definition, test, severity, treatment, pregnancy/child dosing, follow-up.
- Stock/RDT availability.
- Surveillance and outbreak signal.

#### NCD

- Hypertension, diabetes, cardiovascular, chronic respiratory, kidney, and sickle-cell pathways.
- Risk assessment, monitoring, medication refill, lifestyle support, complications, and referral.
- Community screening and continuity.

#### Mental health

- Capacity and consent.
- Screening and structured assessment.
- Risk/safeguarding/suicide assessment.
- Voluntary/involuntary status and legal documentation.
- Crisis plan, therapy, medication, follow-up, and referral.
- Enhanced confidentiality.

#### Oncology

- Diagnosis/staging.
- Multidisciplinary review.
- Protocol/regimen version.
- Body-surface/dose and safety checks.
- Cycle scheduling, labs, authorization, preparation, administration, toxicity, and outcomes.
- Palliative/supportive care.

#### Dialysis/nephrology

- Prescription, schedule, machine/station, vascular access.
- Pre/intra/post observations, fluid target, medications, complications.
- Consumables/water quality and maintenance.

#### Cardiology

- ECG/device integration.
- Echocardiography/imaging reports.
- Risk calculators.
- Heart failure/anticoagulation/chronic follow-up.

#### Rehabilitation, disability, and palliative care

- Functional assessment.
- Therapy goals/plans/sessions.
- Assistive device.
- Home/community plan.
- Pain/symptom control and advance-care preferences.
- Caregiver support.

#### Additional specialty packs

- Dental/oral health.
- Eye/ophthalmology.
- ENT.
- Dermatology.
- Nutrition/dietetics.
- Occupational and school health.
- Geriatrics/home care.
- Sickle cell.
- Infectious disease/AMR stewardship.

### 13.6 Diagnostics

#### Laboratory information system

- Test catalogue, panels, methods, specimen requirements, price, reference ranges, and turnaround.
- Order and accession.
- Label/barcode.
- Collection, transport, receipt, rejection, aliquot, storage, and disposal.
- Chain of custody.
- Worklists and analyzer routing.
- Manual/analyzer result entry.
- Unit, reference interval, flags, delta checks, and validation.
- Technical/clinical verification and co-signature.
- Critical-result escalation and acknowledgement.
- Corrected/amended result.
- QC, calibration, reagent lot, EQA/proficiency, maintenance, and downtime.
- Referral lab and result return.
- Blood bank, microbiology/culture/susceptibility, pathology, and molecular extensions.

#### Radiology/RIS/PACS

- Exam catalogue and protocol.
- Order vetting, safety screening, pregnancy/contrast checks.
- Appointment/worklist and modality status.
- DICOM study ingestion and storage.
- Reporting, templates, voice/transcription integration, and verification.
- Critical finding notification.
- Image sharing and patient access.
- Radiation dose and contrast reaction.

#### Point-of-care/devices

- Approved device registry.
- Device-patient-user association.
- Calibration/maintenance status.
- Offline result capture.
- Raw reading and interpreted observation.
- Provenance and quality flag.

### 13.7 Medicines, pharmacy, and supply chain

#### Medication knowledge

- Generic/brand/product/strength/form/route/package hierarchy.
- Country regulator and manufacturer/source identity.
- Formulary and facility availability.
- ATC/DDD, INN, WHO AWaRe, contraindication, allergy, interaction, duplication, dose range, pregnancy/lactation, renal/hepatic rules from validated sources.
- Local treatment/guideline linkage.
- Knowledge version and licence.

#### Prescribing

- Medication reconciliation.
- Structured prescription, indication, dose, route, frequency, duration, quantity, repeats, substitutions, and instructions.
- Weight/age/renal/pregnancy checks.
- Allergy/interaction/duplicate/contraindication.
- Controlled-drug/e-signature rules.
- Prescriber credential/scope.
- Prior authorization and formulary alternatives.

#### Verification and dispensing

- Pharmacist clinical verification.
- Clarification and intervention.
- Batch/FEFO allocation.
- Partial fill, substitution, refill, transfer, cancellation.
- Label and counselling.
- Patient/guardian identity confirmation.
- Dispense event and prescription balance.
- Return/reversal and destruction.

#### Retail POS

- Cash/till shift open and float.
- Scan/search/cart.
- Prescription/OTC classification.
- Authoritative pricing, tax, discount approval, and promotion.
- Cash/mobile-money/card/credit/split payment.
- Durable idempotent sale.
- Receipt and reprint controls.
- Refund/void/reversal.
- End-of-shift count, variance, handover, and reconciliation.
- Offline allocation and reconnect reconciliation.

#### Inventory

- Multi-store/branch/bin.
- Product/batch/lot/serial/expiry/cost.
- Receipt, put-away, issue, dispense, sale, transfer, adjustment, count, return, recall, quarantine, damage, expiry, disposal.
- Append-only movement ledger.
- FEFO and reorder.
- Cycle/physical count and approval.
- Stock availability network with freshness and confidence.
- Cold-chain temperature and excursions.
- Controlled-drug register/witness/count.

#### Procurement

- Supplier and licence.
- Requisition, approval, RFQ, quotation, PO, delivery, inspection, goods receipt, invoice match, payment status.
- Contract/catalog/pricing.
- Lead time, fill rate, quality, and supplier performance.
- Central purchasing and facility replenishment.

#### Traceability and pharmacovigilance

- GS1 identity and trace events.
- Source, batch, serial, movement, location.
- Recall and affected patient/facility trace.
- Suspected counterfeit/substandard product.
- ADR, medication error, AEFI, and poor-quality report.
- Approved submission channel and acknowledgement.

### 13.8 Revenue, payer, and payment

#### Service and price catalogue

- Service/product/bundle.
- Facility/payer/cash price.
- Effective dates and version.
- Tax/exemption.
- Contract rules, exclusions, limits, and copay.

#### Revenue-cycle workflow

- Eligibility and benefit.
- Estimate and patient acknowledgement.
- Deposit/guarantee.
- Charge capture from completed work.
- Coding and claim preparation.
- Invoice, statement, and receipt.
- Cashier/till.
- Payment allocation.
- Refund, reversal, waiver, write-off, and approval.
- Daily settlement and reconciliation.
- Accounts receivable and collections.
- General-ledger/accounting export.

#### Insurance/payer

- Member/coverage.
- Eligibility.
- Referral/authorization.
- Preauthorization request/response.
- Claim with clinical/financial attachments.
- Submission acknowledgement.
- Adjudication, rejection, denial, partial payment, remittance.
- Appeal/resubmission.
- Contract utilization, capitation, RBF, and limits.
- Fraud/waste/abuse controls.

#### Payments

- Mobile money, card, bank, cash, voucher, and approved alternatives.
- Provider transaction/reference.
- Webhook inbox and signature verification.
- Pending/success/failure/reversal/chargeback.
- Idempotency and reconciliation.
- No stored-value wallet or settlement activity without determining Bank of Uganda obligations.

### 13.9 Patient, caregiver, and community

#### Patient health record

- Identity and facility affiliations.
- Appointments and queue.
- Visit summaries, conditions, allergies, medications, immunizations, labs, reports, documents.
- Portable summary and QR/offline emergency summary with expiration.
- Access/correction request.
- Consent and sharing.
- Proxy/dependents/caregivers.
- Bills, claims, payments, and receipts.
- Complaints and feedback.

#### Engagement

- Medication/refill/appointment reminders.
- Care-plan tasks and symptom check-ins.
- Reviewed education in appropriate language and literacy.
- Secure messages.
- Notification privacy/preferences.
- Call-centre/SMS/USSD/IVR paths.
- Accessibility and assisted-use mode.

#### Telehealth

- Regulator-approved eligibility.
- Relationship/facility/practitioner validation.
- Consent, location, emergency plan, and identity.
- Intake/triage and scheduling.
- Secure video/audio/chat.
- Documentation, orders/prescription, payment, and follow-up.
- Technical quality and escalation to in-person care.

#### Community/VHT

- Household and member register.
- Geographic/catchment assignment.
- Screening, risk, pregnancy, newborn, immunization, nutrition, HIV/TB/malaria/NCD activities.
- Outreach session and stock.
- Referral and counter-referral.
- Defaulter tracing.
- Community events and alerts.
- Offline dataset assignment and supervisor review.
- Safety, consent, and minimum-data collection.

#### Remote monitoring

- Device enrolment and consent.
- Measurement plan.
- Threshold/rule version.
- Missing-data and alert workflow.
- Clinician review and escalation.
- Device quality/maintenance.
- Avoid unsupported continuous surveillance.

### 13.10 Public health

- Versioned notifiable-disease case definitions.
- Immediate case alert and escalation.
- Case investigation, contacts/exposures, laboratory, treatment, vaccination, and outcome.
- Cluster/outbreak detection with human epidemiology review.
- Geospatial maps with privacy-preserving aggregation.
- IDSR/eIDSR and programme reporting.
- DHIS2/eHMIS indicators and data quality.
- Maternal/perinatal/death surveillance and response.
- Immunization coverage and AEFI.
- AMR and antimicrobial use.
- Medicine/diagnostic availability surveillance.
- Event-based surveillance and community reports.
- Emergency operations dashboards.
- One Health adapters for animal/environment data without mixing access domains.

### 13.11 Workforce and facility operations

#### Workforce

- Staff registry and credentials.
- Establishment/position.
- Recruitment/onboarding/offboarding.
- Roster, shift, attendance, leave, on-call, and handover.
- Scope, supervision, CPD, licence expiry.
- Workload, productivity, wellbeing, and safety.
- Payroll/HR adapter rather than uncontrolled duplication where an HR system exists.

#### Assets and biomedical engineering

- Asset/device register.
- Location, owner, status, warranty, supplier.
- Preventive/corrective maintenance.
- Calibration and safety inspection.
- Parts and service history.
- Downtime and clinical impact.
- Oxygen plant/cylinder/concentrator tracking.
- Cold-chain equipment.

#### Facility services

- Housekeeping and bed turnaround.
- Infection prevention and environmental rounds.
- Waste and sharps.
- Laundry/linen.
- Kitchen/diet.
- Security and visitor.
- Transport/fleet.
- Maintenance/work orders.
- Mortuary and body/property chain of custody.

#### Quality and patient safety

- Incident/near-miss/adverse event.
- Safeguarding.
- Infection surveillance.
- Mortality/morbidity review.
- Audit and guideline compliance.
- Corrective/preventive action.
- Complaints and resolution.
- Accreditation evidence.

### 13.12 Analytics, research, and learning health system

#### Operational analytics

- Data-quality completeness, accuracy, timeliness, duplicates, and coding.
- Patient flow, wait, turnaround, bed occupancy, cancellation, and follow-up.
- Stock, expiry, availability, procurement, and supplier.
- Revenue, reconciliation, denial, and cost.
- Workforce and service capacity.
- Sync/integration/notification health.

#### Clinical quality

- Outcome and process measures.
- Risk-adjusted cohorts where appropriate.
- Guideline adherence.
- Safety events.
- Equity by geography, sex, age, disability, language, payer, and facility—within privacy limits.

#### Research

- Research/QI classification.
- Protocol, ethics/REC, UNCST/regulator approval.
- Dataset request and data-use agreement.
- Cohort builder.
- De-identification/pseudonymization.
- Data lineage and reproducible extract.
- Secure analysis enclave.
- Registry/trial support.
- Participant consent/withdrawal where applicable.
- Publication/output review.
- Federated analysis for cross-border work.

No care data should silently become model-training data. Uganda's [2025 national research-participant guidelines](https://www.uncst.go.ug/files/downloads/NATIONAL%20GUIDELINES%20FOR%20RESEARCH%20INVOLVING%20HUMANS%20AS%20RESEARCH%20PARTICIPANTS%202025.pdf) should be reflected in product controls.

### 13.13 Developer and partner platform

- Versioned API catalogue and OpenAPI.
- FHIR implementation guide and sandbox.
- SDKs and reference integrations.
- OAuth/client credentials and scoped access.
- Webhooks with signatures, retry, replay, and delivery log.
- Test patients/data and conformance suites.
- Partner onboarding, data-sharing agreement, security review, and certification.
- Integration registry and health dashboard.
- App/module marketplace only after a permission, safety, and support model exists.

---

## 14. Uganda legal, regulatory, and policy baseline

This section is an implementation checklist, not a final legal opinion.

| Area | Required platform posture |
|---|---|
| PDPO registration/governance | Register/renew as applicable, appoint a DPO, maintain governance, processor contracts, training, and annual compliance evidence. |
| Controller/processor roles | Map controller, joint controller, and processor per tenant/workflow. Do not use one blanket SaaS statement. |
| Lawful basis/purpose | Record purpose and lawful basis per flow. Consent is not the sole basis for all healthcare processing. |
| Special health data | Apply stricter access, disclosure, notification, retention, and audit to health and medical records. |
| Patient rights | Implement access, correction, complaints, withdrawal, and lawful deletion/de-identification. Track statutory response periods. |
| Children/guardians | Verify authority, support assent and emergency exceptions, and use domain-specific minor rules. |
| Retention | Use record-class schedules, legal holds, archive, and verifiable destruction; obtain written periods by facility/specialty. |
| Breach | Rapidly detect, preserve evidence, assess, and notify the PDPO as legally required. |
| Cross-border/cloud | Maintain transfer assessment, destination protection, subprocessors, contracts, and written sector guidance. |
| DPIA | Require DPIAs for biometrics, AI, location, large-scale records, new technology, and other high-risk processing. |
| Facility/practitioner | Verify facility and practitioner licensing, annual status, scope, supervision, and expiry. |
| Telemedicine | Confirm the care model, parent facility, Uganda-licensed practitioner, prior relationship, inspection, and cross-border rules with UMDPC. |
| HIV | Segmented/discreet access and notifications, disclosure accounting, counselling, and programme-specific rules. |
| Mental health | Capacity, representative authority, voluntary/involuntary state, least-restrictive care, and enhanced confidentiality. |
| Electronic records/signatures | Preserve signer identity, time, version, provenance, integrity, and addenda; confirm controlled prescription rules. |
| Pharmacy | Licensed premises/personnel, prescriptions, indexed patient records, authorized sources, batch/expiry/quantity, controlled registers, recall/quarantine, and inspection export. |
| Pharmacovigilance | Capture/report ADRs, errors, poor-quality/counterfeit products through approved channels. |
| Laboratory | Verify AHPC/facility requirements and implement chain of custody, QC/EQA, critical results, amendments, and retention; target ISO 15189. |
| Public health | Versioned notifiable-disease forms/deadlines, immediate alerts, and routine reporting for public/private participants. |
| Research | Separate care, QI, and research; enforce REC/UNCST/NDA approvals and data-use controls. |
| AI/SaMD | Obtain written classification and maintain human review, validation, monitoring, and safety evidence. |
| Payments | Use licensed PSPs. Determine BoU obligations before holding, aggregating, or settling funds. |
| Accessibility | Target WCAG 2.2 AA and accessible mobile/low-bandwidth/assisted pathways. |

Useful primary sources:

- [Uganda Data Protection and Privacy Act](https://ulii.org/en/akn/ug/act/2019/9/eng%402019-05-03)
- [Data Protection and Privacy Regulations](https://ulii.org/en/akn/ug/act/si/2021/21/eng%402021-03-12)
- [PDPO organization guidance](https://pdpo.go.ug/information-center/organisation)
- [PDPO annual compliance guidance](https://pdpo.go.ug/media/2024/01/Guidance-Note-on-Completion-of-the-Annual-DPP-Compliance-Report.pdf)
- [UMDPC digital-health/telemedicine requirements](https://www.umdpc.go.ug/downloads/requirements/requirements.pdf)
- [NDA human medicines/pharmacy guidance](https://www.nda.or.ug/human-medicine-guidelines/)
- [NDA product safety/pharmacovigilance](https://www.nda.or.ug/directorate-of-product-safety/)
- [AHPC requirements](https://www.ahpc.ug/page/requirements)
- [National Payment Systems Act](https://ulii.org/en/akn/ug/act/2020/15/eng%402023-12-31)
- [Persons with Disabilities Act](https://ulii.org/en/akn/ug/act/2020/3/eng%402023-12-31)
- [Public Health Act](https://ulii.org/en/akn/ug/act/ord/1935/13/eng%402023-12-31)

The [National Drug and Health Products Authority Act 2026](https://ulii.org/en/akn/ug/act/2026/5/eng%402026-05-08) was listed as uncommenced at this snapshot. Product rules must be switchable and monitored as the regulatory transition occurs.

### Written decisions required before production

1. UMDPC telemedicine rules for each tenant/service/cross-border practitioner.
2. PDPO/MoH position on cloud region, transfers, controller roles, and multi-tenancy.
3. Retention periods by record class, facility, and specialty.
4. Minor/adolescent consent for general, HIV, sexual/reproductive, mental-health, and research contexts.
5. Electronic prescribing/signature and controlled-medicine rules.
6. AI/software-as-medical-device classification under current and incoming law.
7. Bank of Uganda boundary for platform payment collection, aggregation, escrow, or settlement.
8. MoH HIIRE/digital-solution approval and HIE/DHIS2 onboarding.
9. NIRA/UGHub identity use, agreements, and permitted matching.
10. Whether each analytics activity is operations/QI or regulated research.
11. Current successor/transition policy after the 2020/21–2024/25 dedicated digital-health plan.

---

## 15. Standards baseline

| Layer | Proposed baseline |
|---|---|
| Clinical exchange | FHIR R4/4B subject to MoH confirmation, Uganda implementation guide, HL7v2 adapters |
| Portable summary | International Patient Summary |
| Aggregate/public health | DHIS2-compatible exchange, IHE ADX/FHIR workflows where approved |
| Terminology | ICD-10/11 mappings, LOINC, UCUM, INN, ATC/DDD, WHO AWaRe, GS1, country/NDA product IDs |
| SNOMED CT | Use only after confirming territorial licensing and implementation terms: [SNOMED licensing](https://www.snomed.org/get-snomed) |
| Imaging | DICOM/DICOMweb |
| Lab/device | HL7v2, ASTM at edge, IEEE 11073 where appropriate |
| Supply traceability | GS1 identifiers and nationally approved event model |
| Clinical logic | Localized WHO SMART Guideline Digital Adaptation Kits: [WHO SMART Guidelines](https://www.who.int/teams/digital-health-and-innovation/smart-guidelines) and [SMART catalogue](https://smart.who.int/) |
| Security/privacy | ISO 27001, ISO 27701, ISO 22301; OWASP ASVS/MASVS as engineering targets |
| Safety software | IEC 62304, ISO 14971, IEC 81001-5-1, ISO 82304-1, ISO 13485 where applicable |
| Laboratory quality | ISO 15189 target |
| Accessibility | WCAG 2.2 AA and mobile accessibility testing |

The [WHO Digital Health Platform Handbook](https://www.who.int/publications/i/item/9789240013728) is a useful reference for the platform approach. WHO also documents FHIR-based offline guidance for Android: [FHIR-based SMART Guidelines](https://www.who.int/teams/digital-health-and-innovation/smart-guidelines/fhir-based-smart-guidelines).

---

## 16. Country packs and global expansion

Uganda-first is a strength. Uganda hardcoding is not.

### Country-pack contents

Every pack should be independently versioned, effective-dated, signed, tested, and assigned to a tenant:

#### Legal and governance

- Controller/processor model.
- Registration/licensing evidence.
- Data residency and transfer.
- Retention and legal hold.
- Breach and rights workflow.
- Child/guardian/consent rules.
- Telehealth policy.
- Research/secondary use.
- AI/medical-device classification.

#### Health system

- Facility levels/types.
- Practitioner roles/scopes/licensing registries.
- Facility and product registries.
- National IDs/alternate identifiers.
- Referral levels and public/private networks.
- Programme forms and report schedules.

#### Clinical

- Guidelines and care pathways.
- Drug formulary.
- Immunization schedule.
- Laboratory reference ranges.
- Case definitions.
- Terminology profiles/mappings.

#### Interoperability

- FHIR profiles/extensions.
- HIE endpoints and authorization.
- DHIS2 data sets/org units.
- eLMIS/eLIS/eIDSR/registry adapters.
- Payer/claim formats.
- Payment providers.

#### Localization

- Languages and reviewed clinical translations.
- Currency and money rounding.
- Time zone/date/number.
- Address/phone.
- Tax/fiscal receipt.
- Units.
- Accessibility/low-literacy content.

### Expansion model

1. Prove the Uganda kernel and country pack.
2. Select one EAC country with a strong implementation/regulatory partner.
3. Run a formal gap assessment; do not clone Uganda configuration.
4. Deploy a country/regional data plane.
5. Exchange only minimum authorized summaries/referrals initially.
6. Certify country pack, integrations, clinical content, and support.
7. Scale through implementation partners while preserving platform conformance.

---

## 17. Codebase restructuring

### 17.1 Consolidate route topology

Retire the three competing hospital structures:

- older `/admin/*`;
- newer `/hospital/admin/*`;
- tenant `/os/[slug]/*`.

Proposed URL/workspace model:

```text
/platform/*                         global control plane
/facility/[facility]/admin/*        configuration and administration
/facility/[facility]/clinical/*     care delivery
/facility/[facility]/operations/*   pharmacy, lab, imaging, supply, revenue
/patient/*                          patient/caregiver
/community/*                        CHW/outreach
/pharmacy/*                         standalone pharmacy product where appropriate
/developer/*                        partner sandbox/docs
```

Do not physically move everything at once. Introduce canonical routes, redirect old paths, migrate one vertical journey, measure usage, then retire.

### 17.2 Proposed monorepo structure

```text
apps/
  platform-web/
  facility-web/
  pharmacy-web/
  patient-mobile/
  community-mobile/
  edge-gateway/
  workers/
packages/
  contracts/
  request-context/
  policy/
  identity/
  registry/
  consent/
  clinical/
  orders/
  diagnostics/
  medication/
  pharmacy/
  revenue/
  public-health/
  interoperability/
  sync/
  country-packs/
  terminology/
  intelligence/
  observability/
  ui/
  testing/
```

This is a target ownership model, not a required immediate directory migration.

### 17.3 Product truth registry

Create a machine-readable registry for every module:

```yaml
id: pharmacy.pos
owner: medicines-squad
status: pilot
personas: [cashier, pharmacist, pharmacy_admin]
journeys:
  - cash-sale
routes: []
commands: []
events: []
tables: []
capabilities: []
offlinePolicy: bounded-write
countryPacks: [ug]
clinicalRisk: medium
financialRisk: high
regulatoryControls: []
tests:
  contract: []
  authorization: []
  e2e: []
  offline: []
```

Generate navigation, documentation, entitlements, support readiness, and status pages from this registry. A page cannot make itself “available.”

### 17.4 Domain contracts

Each bounded context exposes:

- commands;
- queries/projections;
- events;
- schemas;
- invariants;
- authorization policy;
- offline policy;
- audit requirements;
- tests.

Pages and route handlers must not freely query arbitrary tables. Start by wrapping current database operations in typed repositories, then move workflow rules into command handlers.

### 17.5 One auth model

Choose:

- Supabase Auth end-to-end with a reviewed membership/context layer; or
- a BFF/session identity system that keeps the Data API private.

Do not continue a hybrid where custom profile IDs, Supabase `auth.uid()`, browser clients, service-role clients, and multiple cookies/JWTs imply different identities.

### 17.6 Durable work

Move these out of fire-and-forget request code:

- email/SMS/push;
- payment webhooks and reconciliation;
- FHIR/webhook delivery;
- DHIS2 submission;
- claims/referrals;
- import/export;
- AI jobs;
- patient alerting;
- stock/public-health rule evaluation.

Use transactional outbox, durable queue, consumer inbox, retry, dead letter, and operator replay.

### 17.7 Design system

Either make `@synapse/ui` the actual cross-app design system or remove the fiction. A mature system should include:

- tokens and typography;
- accessible primitives;
- forms and validation;
- clinical data display;
- status/severity semantics;
- offline/sync indicators;
- error/loading/empty/stale states;
- table/grid/mobile patterns;
- print/receipt/document components;
- localization and RTL readiness;
- Storybook/visual regression/accessibility tests.

### 17.8 Remove or quarantine dead surfaces

- Archive or remove the stale Prisma model after schema reconciliation.
- Keep legacy demo code outside build/lint/type paths.
- Remove orphan tables such as `restaurants` after confirming no remote dependency.
- Replace fixed-success routes with `501 Not Implemented` or remove them.
- Hide incomplete navigation behind status registry/flags.
- Repair broken mobile/web deep links.
- Do not advertise integrations whose callback still contains a token-exchange TODO.

---

## 18. Engineering quality system

### Definition of Done

A healthcare feature is done only when it has:

1. named user and clinical/operational journey;
2. acceptance and hazard criteria;
3. implemented UI, API/command, and persistent data;
4. server-derived authorization and tenant isolation;
5. validation and domain invariants;
6. consent/privacy/retention policy;
7. audit/provenance;
8. offline behaviour or explicit online-only downtime policy;
9. loading, empty, stale, conflict, unavailable, and error states;
10. accessibility and localization;
11. metrics, logs, traces, and alerting;
12. unit, integration, contract, authorization, migration, and end-to-end tests;
13. clinical validation where applicable;
14. support/runbook/training/documentation;
15. rollback/data-migration plan;
16. regulatory approval/evidence where required.

“Page exists” and “table exists” are not completion criteria.

### Test pyramid

#### Database

- Clean migration/reset.
- Constraint and trigger tests.
- RLS/ACL matrix.
- Definer-function caller tests.
- Cross-tenant property tests.
- Ledger invariants.
- Migration upgrade/rollback rehearsal.

#### Domain

- Command invariants.
- State machines.
- Idempotency.
- Money rounding/tax.
- Stock allocation/FEFO.
- Medication/clinical rules.
- Consent/access decisions.

#### Contract

- API/OpenAPI.
- FHIR conformance.
- DHIS2 mappings.
- Webhook signatures/replay.
- Provider error/timeout.
- Schema compatibility.

#### Application

- Critical end-to-end journeys.
- Role/persona navigation.
- Accessibility.
- Visual regression.
- Mobile deep links.
- Printing/scanning.

#### Offline/chaos

- Drop, duplicate, reorder, retry, restart, conflict, expiry, long outage, and recovery.

#### Security

- SAST/dependency/secret/IaC.
- Auth bypass.
- IDOR/BOLA.
- Rate/abuse.
- upload/malware.
- penetration tests.

#### Clinical safety

- Reference cases.
- red flags;
- dose/rule boundaries;
- model abstention;
- subgroup performance;
- clinician usability;
- adverse-event simulation.

### CI/CD gates

- lockfile reproducibility;
- formatting/lint/type checks;
- unit/integration tests;
- clean database reset;
- generated type/schema drift;
- RLS/function ACL tests;
- contract/conformance;
- build/export for all apps;
- dependency/licence/SBOM;
- secret scan;
- migration rehearsal;
- deployment smoke and rollback readiness.

Current root type checking is affected by React 18/19 type collisions between Expo and Next workspaces, and application lint/build verification has a large warning/error burden. Separate TypeScript project references/build graphs, pin compatible types per workspace, and keep mobile types from polluting web compilation.

### Verification snapshot

Checks run against this working tree on 28 July 2026:

| Check | Result | Interpretation |
|---|---|---|
| Web TypeScript | Pass | `tsc --noEmit` passes for `@synapse/web` |
| Pharmacy TypeScript | Pass | `tsc --noEmit` passes for `@synapse/pharmacy` |
| Mobile TypeScript | Fail | Widespread React/JSX type incompatibility between the Expo React 18 graph and root React 19 types |
| Pharmacy tests | Pass | 57 Vitest tests plus 3 Node tests pass; useful but narrow relative to the product surface |
| Migration filename/order check | Pass | 33 migration files pass the repository's lightweight script; this does not execute/reconstruct the database |
| Web lint | Warning debt | 159 warnings, dominated by `any`, unused code, and related issues |
| Pharmacy lint | Warning debt | 330 warnings, including missing hook dependencies, `any`, unused code, and image/accessibility concerns |
| Web production build | Fail | In addition to blocked Google Font download, a real client/server boundary error imports `next/headers` through a client-side receipt editor graph |
| Pharmacy production build | Inconclusive/fail in restricted network | Build reaches Google Font fetch and fails because network access is blocked; self-host fonts to make builds deterministic |

The web build import trace runs from the server-only Supabase module through receipt document settings and `ReceiptDocument` into `document-editor-form.tsx`. Split pure document settings/types from server data access and ensure client components never import a module containing `next/headers`.

Builds should not depend on fetching Google Fonts at compile time. Store approved font assets in the repository or an internal artifact pipeline and use `next/font/local`.

### Observability

Implement:

- structured logs with request/correlation/tenant/facility;
- OpenTelemetry traces across request, database, queue, and integration;
- error reporting;
- RED metrics for APIs and workers;
- database latency/connections/locks;
- queue backlog, age, retry, dead letter;
- offline sync lag, command rejection, conflict, and loss;
- FHIR/DHIS2/payment/push delivery and acknowledgement;
- security/audit pipeline health;
- tenant-facing status where appropriate;
- synthetic critical-journey probes.

Do not hardcode health values such as RLS coverage or connection counts. Measure them.

---

## 19. Delivery roadmap

> The balanced, outcome-led roadmap in [the ecosystem operating model](./SYNAPSE_ECOSYSTEM_OPERATING_MODEL_2026.md#21-outcome-led-delivery-roadmap) is authoritative. The phases below remain useful as detailed engineering scope, but pharmacy and facility work must ship inside releases that also include Synapse App and shared Core guarantees.

Dates are illustrative for a properly staffed programme. Movement between phases should be based on acceptance gates, not calendar optimism.

### Phase 0 — Safety and product truth (0–30 days)

#### Product

- Publish the maturity/status registry.
- Remove or qualify unsupported claims.
- Hide/label placeholders.
- Select the first three-product vertical journey.
- Freeze new module shells.

#### Security/data

- Audit and lock all functions/grants/RLS.
- Disable public/cross-user AI and unsafe customer auth.
- Fix POS discount/tax/security.
- Disable fake offline success.
- Remove authenticated service-worker caching.
- Namespace/encrypt/purge local caches.
- Correct mobile capability checks and unavailable states.
- Complete live-schema inventory.

#### Governance

- Appoint clinical safety, privacy/DPO, and security owners.
- Start regulator/counsel decision register.
- Complete breach/incident basics.
- Begin privacy notices and processing register.

**Exit gate:** no known trivial cross-tenant/anonymous path; no fake durable success; no material public claim known to be false.

### Phase 1 — Reproducible foundation (1–3 months)

- One canonical identity/membership/capability model.
- Trusted request context.
- Reproducible database baseline and drift gate.
- Domain contracts/repositories.
- Transactional outbox/inbox.
- Country-pack foundation for Uganda.
- Terminology/config versioning.
- Object-storage governance.
- CI/security/observability baseline.
- Design-system foundation.
- Offline sync protocol and edge proof of concept.

**Exit gate:** clean environment can be rebuilt from source; tenant-isolation test matrix passes; one durable event flows end-to-end with replay.

### Phase 2 — Pharmacy production wedge (3–9 months)

- Correct authoritative POS financial logic.
- Till/shift and reconciliation.
- Real encrypted local store.
- Command/inbox/change sync.
- Multi-counter/edge strategy.
- Prescription verification/dispensing.
- Batch ledger and stock reconciliation.
- Controlled drugs, recall/quarantine/disposal.
- Supplier/procurement hardening.
- Mobile money/payment reconciliation.
- Privacy/regulatory inspection exports.
- Pilot implementation/training/support.

**Exit gate:** pharmacy journey passes security, financial, offline chaos, restore, and field acceptance; zero unaccounted offline sales in test/pilot.

### Phase 3 — Registration and OPD production wedge (3–12 months)

- MPI/search/duplicate/merge.
- Consent/guardian/privacy.
- Scheduling/check-in/queue/triage.
- Clinician workspace and signed note.
- Orders/results.
- Prescription to pharmacy.
- Charge/invoice/payment.
- Discharge/follow-up/referral.
- Patient summary and mobile view.
- Clinical safety review and Uganda content validation.

**Exit gate:** a complete patient visit crosses registry, clinical, diagnostics/medication, finance, patient, and audit without manual re-entry.

### Phase 4 — Diagnostics, inpatient, maternity, and community (9–24 months)

- LIS and lab edge adapters.
- RIS/PACS.
- ADT/bed/nursing/eMAR.
- Emergency/theatre/ICU selected by pilot need.
- ANC/labour/newborn/postnatal.
- Immunization and community/VHT.
- Referral and transport.
- Facility edge package.

Build specialty packs according to health impact and implementation partners, not route order.

### Phase 5 — National exchange and financing (12–30 months)

- MoH-approved HIE/FHIR profiles.
- DHIS2/eHMIS exporter.
- eLMIS/eLIS/eIDSR and registry adapters.
- Traceability.
- Payer eligibility/preauth/claims.
- Public-health surveillance and EOC.
- Multi-facility referral network.
- Mature operations/SRE/DR.

### Phase 6 — Regional platform (24–60 months)

- Dedicated country-pack programme.
- Regional data-plane routing.
- EAC patient-authorized portable summaries/referrals.
- Partner/developer certification.
- Research enclaves/federated analytics.
- AI scale only after local evaluation and regulatory classification.
- Local implementation/support ecosystem.

---

## 20. Recommended first programme backlog

### First 10 engineering epics

1. **Product truth and route consolidation**
   - status registry;
   - navigation generated from status;
   - placeholder removal/labeling;
   - canonical facility route decision.

2. **Database source of truth**
   - live object inventory;
   - ACL/RLS/function report;
   - canonical baseline;
   - CI drift check.

3. **Identity and request context**
   - account/person/membership/role assignment;
   - active workspace;
   - one session model;
   - central policy engine.

4. **Security P0 closure**
   - function ACLs;
   - service-role containment;
   - AI endpoint auth;
   - customer auth replacement;
   - push/cache privacy.

5. **Financial and inventory ledger**
   - money type/rounding;
   - price/tax authority;
   - stock movement ledger;
   - till/shift/reconciliation;
   - reversal model.

6. **Sync kernel**
   - command contracts;
   - client outbox;
   - server inbox;
   - change cursor;
   - conflict/operator console.

7. **Pharmacy offline vertical slice**
   - encrypted local DB;
   - one sale;
   - FEFO allocation;
   - durable receipt;
   - reconnect and reconciliation.

8. **Registry and consent**
   - patient identifiers/matching;
   - guardians/proxies;
   - consent/restrictions;
   - disclosure/access workflow.

9. **OPD vertical slice**
   - registration through follow-up;
   - medication/revenue connections;
   - mobile patient summary.

10. **Durable integration/notification workers**
    - outbox/inbox;
    - communication preferences and receipts;
    - FHIR/DHIS2 adapter framework;
    - payment reconciliation.

### First 10 non-engineering workstreams

1. Uganda regulatory counsel and decision log.
2. PDPO/DPO/privacy programme.
3. Clinical safety management system.
4. Pharmacy workflow and NDA compliance validation.
5. MoH/HIIRE/HIE engagement.
6. Pilot facility selection and readiness assessment.
7. Clinical content/terminology governance.
8. Implementation, training, support, and change management.
9. Commercial model and total-cost-of-ownership.
10. Outcome evaluation and health economics.

---

## 21. Team and governance

### Accountable leadership

- Product/platform leader.
- Clinical safety officer with authority to stop release.
- Data protection officer/privacy lead.
- Security lead.
- Head of engineering/architecture.
- Interoperability/standards lead.
- Uganda implementation/regulatory lead.
- Quality/reliability lead.

### Core squads

#### Platform/trust

Identity, tenancy, consent, policy, audit, country packs, developer platform.

#### Offline/edge

Local databases, sync, device/edge, conflict/reconciliation, release management.

#### Medicines/pharmacy

Medication service, prescribing/dispensing, inventory, procurement, POS, traceability.

#### Facility care

Registry, scheduling, OPD, encounters, orders, nursing/inpatient.

#### Diagnostics

Laboratory, imaging, devices, edge integration.

#### Revenue/financing

Catalog, ledger, payment, claims, reconciliation.

#### Patient/community/public health

Mobile/PHR, proxy, engagement, CHW, referral, surveillance.

#### Data/intelligence

Terminology, analytics, AI governance, research.

### Cross-cutting functions

- Clinicians and pharmacists embedded in product teams.
- Nursing/lab/radiology/health-information/public-health subject-matter experts.
- Security/privacy/regulatory.
- SRE/observability.
- QA/test automation and clinical simulation.
- Accessibility/localization/content design.
- Field implementation, training, support, and customer success.

### Governance forums

- Clinical safety board.
- Data/privacy governance committee.
- Architecture review.
- Change/release advisory for high-risk workflows.
- Terminology/guideline committee.
- AI model/use-case review.
- Incident and post-incident review.
- Country-pack certification board.

---

## 22. Success measures

### Platform integrity

- Unauthorized cross-tenant access attempts blocked.
- Function/RLS/permission test coverage.
- Audit-event delivery completeness.
- Restore success and measured RTO/RPO.
- Critical vulnerability time to remediation.

### Offline

- Locally accepted commands lost: target zero.
- Duplicate financial/clinical commands: target zero.
- Median/p95 sync lag.
- Conflict rate by domain.
- Reconciliation backlog/age.
- Edge uptime and maximum successful outage.

### Clinical

- Record completeness.
- Allergy/interaction/critical-result acknowledgement.
- Time to triage/treatment/result.
- Medication error and near-miss.
- Referral completion.
- Follow-up/retention.
- Maternal/newborn/programme outcomes selected with clinical partners.

### Pharmacy/supply

- Stock availability.
- Stock variance.
- Expiry loss.
- Batch traceability completeness.
- Purchase lead/fill rate.
- Till/payment reconciliation.
- Recall completion.

### Revenue

- Charge capture completeness.
- Claim clean-submission/denial rate.
- Days in receivables.
- Payment reconciliation.
- Refund/adjustment approval.
- Patient estimate-to-final variance.

### Public health

- Reporting completeness/timeliness.
- Case alert-to-acknowledgement.
- DHIS2 acceptance/rejection.
- Data quality.
- Outbreak signal-to-investigation.

### Experience and equity

- Task completion/time by persona.
- Support burden.
- Adoption and active use.
- Accessibility defects.
- Completion by language, location, device, connectivity, sex/age/disability where lawful and meaningful.
- Patient understanding and trust.

### Engineering

- Deployment frequency and change failure.
- Mean time to detect/recover.
- Test/conformance gates.
- Schema drift.
- Dead-letter age.
- Placeholder count.
- Fully completed vertical journeys.

---

## 23. Decision register

These architecture/product decisions should be made explicitly and recorded as ADRs:

1. Canonical product name and route hierarchy.
2. Shared SaaS versus dedicated/sovereign deployment classes.
3. Identity provider/session model.
4. Browser Data API exposure versus BFF-only access.
5. Canonical schema and bounded-context ownership.
6. Facility edge runtime, packaging, and support model.
7. Sync protocol and consistency guarantees.
8. Durable job/event infrastructure.
9. FHIR baseline and Uganda implementation guide governance.
10. Terminology licences and distribution.
11. Object storage and key management.
12. Clinical record signing/amendment model.
13. Money/tax/ledger/accounting model.
14. Medication knowledge source.
15. AI provider, region, allowed uses, and medical-device classification.
16. Telemedicine operating model.
17. Uganda hosting/cross-border position.
18. Patient identity/MPI and NIRA/UGHub role.
19. National integration pathway and MoH approvals.
20. Country-pack certification and expansion criteria.
21. Build/partner/integrate choice for every major module.

---

## 24. Current code-specific gap register

This register complements the target capability universe. It records concrete repository weaknesses that can otherwise disappear inside a broad roadmap.

| Priority | Area | Current gap | Required disposition |
|---|---|---|---|
| P0 | Offline POS | No-op local persistence followed by receipt and cart clear | Disable, then replace with atomic local command storage |
| P0 | Database RPC | Definer sale/subscription functions do not show complete `PUBLIC` revocation and caller checks | Audit live ACLs; revoke broadly; authorize inside functions; test caller roles |
| P0 | POS accounting | Line discount is accumulated in API and again in SQL | Compute once from authoritative server rules; add database integration tests |
| P0 | POS tax | Client supplies tax amount even though settings are loaded | Calculate tax/rounding server-side from effective rule version |
| P0 | AI coach | Unauthenticated caller can read/write another user's health-chat history | Disable until identity, patient relationship, consent, and rate controls exist |
| P0 | Drug safety | Model outage/error returns `safe: true` | Return unavailable; adopt validated deterministic knowledge source |
| P0 | Mobile authorization | Facility queue does not consistently gate by clinical capability | Central request context and endpoint authorization matrix |
| P0 | Customer auth | Unsalted SHA-256 and identity headers/local UUID | Replace with platform identity and signed/revocable sessions |
| P0 | Local privacy | Authenticated API/navigation cache is not tenant/user scoped | Do not cache private HTTP responses; encrypted identity-scoped vault |
| P0 | Mobile lock | Missing biometrics or exception automatically unlocks | Device-credential fallback and fail closed |
| P0 | Push privacy | Patient label/chief complaint can appear on lock screen | Discreet notification templates and sensitivity policy |
| P0 | Product truth | Offline/FHIR/DHIS2/residency claims exceed evidence | Status registry and immediate copy correction |
| P1 | Schema history | Generated types, migrations, runtime string references, and Prisma disagree | Canonical baseline; clean reset; remote drift gate |
| P1 | Sync schema | Existing queue lacks command ID/hash, revision, lease, retry, result, checkpoint | Replace with complete sync-kernel schema |
| P1 | Sync identity | Queue policy uses `auth.uid()` while custom profile IDs may not align | Resolve one identity model before direct-client sync |
| P1 | Sync conflicts | Health route queries `resolved`, while generated conflict type uses status/resolution fields | Correct schema/API; build real conflict state machine |
| P1 | Mobile cache | Cache key is URL only and logout does not purge | Tenant/user/device/schema namespace, encryption, purge |
| P1 | Mobile outage UX | Network error can look like an empty clinical queue | Render unavailable/stale state; retain last safe projection with timestamp |
| P1 | Mobile token | Commented three-day session does not match signing default | One session policy and automated expiry tests |
| P1 | Broken links | Mobile/API quick actions point to nonexistent web routes | Contract-test every deep link and generate routes from registry |
| P1 | Hospital topology | `/admin`, `/hospital/admin`, and `/os/[slug]` duplicate concepts | Canonical facility workspace with staged redirects |
| P1 | Role taxonomy | Constants, DB constraint, seeds, routing, and pharmacy aliases disagree | One role/capability catalogue generated into all layers |
| P1 | Facility taxonomy | Shared facility types and dashboard resolver disagree | Country-pack facility catalogue and migration |
| P1 | Service role | Broad use amplifies every missing tenant filter | Narrow repositories, policy context, private schemas, review |
| P1 | Browser DB | Many client components directly query tables | Decide BFF vs Data API; centralize policy and typed access |
| P1 | Audit | Some audit writes deliberately fail open | Transactional/mandatory audit for regulated actions; outbox for delivery |
| P1 | Health telemetry | Endpoint includes hardcoded RLS coverage/connection values | Measure live controls; expose evidence timestamp and source |
| P1 | Documents | Identity/licence files stored as base64 data URLs in rows | Governed object store, scan, encryption, retention, signed access |
| P1 | Idempotency | POS helper is designed to fail open if its table is missing | Fail closed for financial commands or use a guaranteed command inbox |
| P1 | Financial deletion | Administrative reset/delete patterns conflict with immutable ledger principles | Reversal/archive controls; no routine destructive financial reset |
| P1 | Impersonation | Long-lived token is placed in a URL between apps | One-time exchange code, very short TTL, audience binding, re-auth, audit |
| P1 | Production build | Server-only `next/headers` enters a client receipt-editor graph | Split pure/client/server modules and add build gate |
| P1 | Mobile build | Expo React 18 and root React 19 types collide | Isolate workspace type graphs and lock compatible dependencies |
| P1 | Deterministic build | Both web apps download fonts during production build | Self-host approved fonts |
| P2 | FHIR | CapabilityStatement advertises resources that are fixed responses | Remove claims or implement profiles, validation, auth, history, conformance |
| P2 | DHIS2 | UI writes pending logs; no worker/acknowledgement | Durable exporter with mappings, validation, submission, reconciliation |
| P2 | Lab/devices | Ingest routes return fixed success without verification or persistence | Edge adapters, mTLS, validation, raw-message audit, acknowledgements |
| P2 | Referral | Route and screens are placeholders | Closed-loop command/event and consent/access contract |
| P2 | Insurance | Coverage/claim routes are placeholders | Payer adapter with eligibility/preauth/claim/remittance lifecycle |
| P2 | Tele-video | Room is visual prototype and LiveKit is not implemented | Confirm regulatory model, then implement secure service or remove claim |
| P2 | Integration catalogue | Providers are marked available although OAuth token exchange is TODO | Separate catalogued, configured, tested, and certified states |
| P2 | Pharmacy network | Snapshot publish is delete/insert and name-based | Transactional versioned catalog/batch identity and freshness |
| P2 | Force sync | Platform action changes `last_synced_at` without performing sync | Real command/acknowledgement or remove action |
| P2 | Notifications | Expo sends are fire-and-forget with no receipt processing | Durable delivery ledger, receipts, invalid-token cleanup, retry |
| P2 | Alert cron | Delivery lacks complete deduplication | Event/idempotency key and delivery state |
| P2 | Background work | Only billing sweep and mobile-alert cron are material scheduled jobs | Durable workers for sync, interop, claims, referrals, import, alerts |
| P2 | Shared UI | `@synapse/ui` has no active consumer | Adopt as governed design system or retire |
| P2 | Localization | Uganda values are hardcoded; no i18n engine | Uganda country pack plus reviewed language/localization framework |
| P2 | Legal rights | Privacy/DPA/withdrawal/accessibility content is placeholder | Operational policy plus product workflows |
| P2 | Accessibility | No system-wide WCAG/mobile accessibility gate | Accessible primitives, audit, automated/manual testing |
| P2 | Clinical content | Uganda guideline references are prompt text, not versioned evidence | Terminology/guideline service, approved content, provenance |
| P2 | AI governance | Isolated model calls bypass a shared use-case registry | Model gateway, risk class, evaluation, monitoring, kill switch |
| P2 | Practitioner verification | AI image resemblance is shown as verification | Primary-source registry/manual verification, liveness where justified |
| P2 | Public health | Epidemiology screens and detection workflows are shells | Versioned IDSR/DHIS2 workflows and public-health governance |
| P2 | Reasoning engine | Reasoning/pattern code is disconnected from active routes | Validate/use through governed intelligence plane or archive |
| P3 | Dead schema/code | Orphan `restaurants`, stale Prisma, quarantined demo, unused tables | Confirm dependencies, archive/migrate/delete deliberately |
| P3 | Page proliferation | Nearly half of web pages are “Coming soon” | Remove dead routes; create only as vertical workflows ship |

---

## 25. Evidence index: important repository findings

### Product claims and route breadth

- [README.md](../README.md#L1)
- [SYNAPSEOS_MRD.md](../SYNAPSEOS_MRD.md#L1)
- [SYNAPSEOS_ECOSYSTEM_FLOW.md](../SYNAPSEOS_ECOSYSTEM_FLOW.md#L1)
- [Hospital module map](hospital-module-map.md#L1)
- [Main marketing comparison claiming offline/FHIR/DHIS2](../apps/web/src/app/page.tsx#L160)
- [Uganda-only data claim](../apps/web/src/app/download/page.tsx#L13)

### Offline and mobile

- [No-op pharmacy offline storage](../apps/pharmacy/lib/offlineStorage.ts#L1)
- [Fake offline success response](../apps/pharmacy/lib/api.ts#L3)
- [POS offline receipt and cart clear](../apps/pharmacy/app/portal/pos/page.tsx#L652)
- [Unscoped service-worker API/navigation caching](../apps/pharmacy/public/sw.js#L94)
- [Mobile URL-only AsyncStorage cache](../apps/app/lib/cache.ts#L77)
- [Mobile logout and fail-open biometric unlock](../apps/app/lib/auth.tsx#L142)
- [Mobile clinical queue endpoint](../apps/web/src/app/api/mobile/queue/route.ts#L1)
- [Mobile queue outage handling](../apps/app/app/%28main%29/queue.tsx#L45)
- [Database offline queue](../supabase/migrations/20260716000001_backfill_missing_baseline_tables.sql#L372)
- [Orphaned sync health query](../apps/web/src/app/api/platform/health/route.ts#L30)

### Interoperability facades

- [FHIR CapabilityStatement](../apps/web/src/app/fhir/metadata/route.ts#L3)
- [FHIR Patient fixed response](../apps/web/src/app/fhir/Patient/%5Bid%5D/route.ts#L3)
- [Lab instrument fixed response](../apps/web/src/app/api/lab/instrument-ingest/route.ts#L1)
- [DHIS2 pending-log action](../apps/web/src/app/platform/dhis2/page.tsx#L26)
- [Generic OAuth callback with token-exchange TODO](../apps/web/src/app/api/integrations/%5Bprovider%5D/callback/route.ts#L1)
- [Pharmacy network snapshot endpoint](../apps/pharmacy/app/api/admin/network/route.ts#L1)

### Clinical placeholders

- [Doctor queue](../apps/web/src/app/doctor/queue/page.tsx#L1)
- [Encounter workspace](../apps/web/src/app/encounter/%5Bid%5D/page.tsx#L1)
- [Nursing ward](../apps/web/src/app/nurse/ward/page.tsx#L1)
- [Lab orders](../apps/web/src/app/lab/orders/page.tsx#L1)
- [Radiology orders](../apps/web/src/app/radiology/orders/page.tsx#L1)
- [ANC](../apps/web/src/app/dept/maternity/anc/page.tsx#L1)
- [Patient consent](../apps/web/src/app/patient/consent/page.tsx#L1)
- [Epidemiology](../apps/web/src/app/epidemiology/page.tsx#L1)

### Security, money, and AI

- [`SECURITY DEFINER` sale function without caller authorization](../supabase/migrations/20260725140000_fix_complete_sale_pending_then_complete.sql#L8)
- [Subscription definer functions and grants](../supabase/migrations/20260620000001_subscription_billing_flutterwave.sql#L161)
- [POS route discount/tax handling](../apps/pharmacy/app/api/admin/pos/complete-sale/route.ts#L113)
- [POS dashboard reading the parallel transaction model](../apps/pharmacy/app/api/admin/dashboard/route.ts#L63)
- [POS report reading the parallel transaction model](../apps/pharmacy/app/api/admin/reports/route.ts#L58)
- [POS command-idempotency helper](../apps/pharmacy/lib/pos/idempotency.ts#L1)
- [Unauthenticated cross-user health coach](../apps/web/src/app/api/health/coach/route.ts#L5)
- [Fail-open generative drug-interaction check](../apps/web/src/app/api/pharmacy/interactions/route.ts#L34)
- [Direct AI diagnosis and caller-provided tenant](../apps/web/src/app/api/ai/diagnose/route.ts#L17)
- [Lock-screen clinical detail in push](../packages/auth/src/mobile-push.ts#L175)
- [Customer login implementation](../apps/pharmacy/app/api/customer/auth/route.ts#L1)
- [Customer order identity headers](../apps/pharmacy/app/api/customer/orders/route.ts#L1)
- [Impersonation token placed in URL](../apps/web/src/app/platform/users/UserActions.tsx#L44)
- [Audit helper's failure behaviour](../packages/db/src/audit.ts#L1)

### Data and legal

- [Generated database types](../packages/db/src/types.ts#L1)
- [Migration checker](../scripts/check-supabase-migrations.mjs#L31)
- [Baseline patient definition](../supabase/migrations/20260511_production_schema.sql#L71)
- [Hospital plan shells without feature assignments](../supabase/migrations/20260704120000_hospital_module_registry_seed.sql#L1)
- [Subscription feature decision](../supabase/migrations/20260620000001_subscription_billing_flutterwave.sql#L198)
- [Hospital provisioning](../apps/web/src/app/api/platform/hospitals/route.ts#L128)
- [Parallel encounter write path](../apps/web/src/app/api/encounters/route.ts#L7)
- [Mobile record-to-patient association](../apps/web/src/app/api/mobile/records/route.ts#L52)
- [Mobile patient-detail authorization path](../apps/web/src/app/api/mobile/patients/%5Bid%5D/route.ts#L9)
- [Stale alternate Prisma schema](../apps/pharmacy/prisma/schema.prisma#L1)
- [RLS audit documentation](superpowers/reports/rls-audit-report.md#L1)
- [Placeholder privacy policy](../apps/web/src/app/legal/privacy/page.tsx#L1)
- [Professional document storage path](../apps/web/src/app/api/auth/signup/professional/route.ts#L90)
- [Shared role constants](../packages/config/src/constants.ts#L35)
- [Current mobile/web production endpoints](../apps/app/app.json#L45)

---

## 26. Final direction

The magnitude is real. SYNAPSE can become much larger than a hospital dashboard or pharmacy POS because its highest-value asset can be the **trusted connective tissue** among patients, facilities, pharmacies, laboratories, payers, public health, and national systems.

That scale will not come from placing every healthcare noun in a sidebar. It will come from a small number of hard guarantees:

- the right person sees the right minimum data for the right purpose;
- care and commerce continue safely when connectivity fails;
- clinical, stock, and financial records cannot silently disappear or mutate;
- every exchange is versioned, authorized, acknowledged, and auditable;
- local law, language, guidelines, and systems can change without forking the core;
- AI can abstain, be inspected, be overridden, and never hide failure;
- every “available” capability has passed a complete operational definition of done.

The recommended transformation is therefore:

> **Reduce superficial breadth, build the platform kernel, prove pharmacy and OPD end to end, connect through real standards, then expand through independently certified modules and country packs.**

That is how SYNAPSE becomes robust and flexible enough for Uganda, credible across East Africa, adaptable across Africa, and interoperable globally.
