# SYNAPSE Community Access Point (CAP) — Target Architecture

Status: **designed only**. This capability is intentionally sequenced after the Synapse Pharm
pilot-critical workflow is operational. It must reuse the shared identity, authorization, audit,
tenant and interoperability spine rather than becoming a separate patient database or app silo.

## 1. Purpose

Community Access Points let patients who do not have a smartphone, reliable data, or usable
portal access retrieve permitted health information through an approved community device.
The initial Uganda model is a VHT-assisted access point; an LC1 location may host a device, but
an LC1 role does not automatically grant clinical-record access.

The patient remains the subject of the session. A VHT or community worker is an authenticated
assistant, not a substitute patient account.

## 2. Identity and trust boundary

A Synapse ID, printed number, card or QR **identifies** a patient; it never authenticates access
by itself.

Every CAP session requires:

1. authenticated access-point/operator identity;
2. patient lookup by Synapse ID/QR or an approved alternative;
3. a second patient/guardian verification factor appropriate to the deployment;
4. an explicit purpose and permitted scope;
5. a short-lived patient session;
6. per-record disclosure/audit events;
7. automatic session termination and local-data cleanup.

Guardian/dependent access must use an explicit relationship/consent model. Emergency access,
if ever introduced, requires a separately approved break-glass policy and enhanced audit.

## 3. Roles

| Actor | Target permission |
|---|---|
| Patient | Permitted patient portal data and actions |
| VHT / approved health worker | Assisted-access workflow only; clinical scope is capability-gated |
| LC1 / non-clinical host | May host/launch the access point but receives no ambient clinical-record browse permission |
| Guardian / caregiver | Only records/actions explicitly delegated by the relationship/consent model |
| Clinician | Existing clinical permissions; responsible for interpretation/action where required |
| Platform support | No default patient browsing; support access follows the separate audited support-session model |

The authorization check is always server-side and combines identity, role/capability, tenant or
care relationship, purpose, patient/guardian authorization and session state.

## 4. Product boundary

CAP is a **mode/surface of the SYNAPSE App + Core**, not a new source of truth.

- Synapse Core: person identity, Synapse ID, external-identifier mapping, consent/delegation,
  capability policy, audit/disclosure events and session issuance.
- Synapse OS: results, referrals, appointments and clinician follow-up workflows.
- Synapse Pharm: prescription/dispense/medicine-availability signals exposed only through
  approved patient-facing contracts.
- Synapse App / CAP: locked-down assisted-access UI and device-session lifecycle.
- Interoperability layer: external identifiers and approved FHIR/HIE adapters remain behind Core.

No CAP-specific copy of a clinical record should be created.

## 5. Initial patient journey

`facility result/prescription -> Synapse ID -> CAP -> verify operator -> verify patient/guardian
-> issue temporary scoped session -> view permitted result/prescription/referral -> acknowledge or
route for clinician help -> end session -> audit disclosure`

Results that require counselling, urgent clinician acknowledgement, or restricted disclosure
must route to the appropriate clinical workflow instead of being revealed by a generic CAP screen.

## 6. Device and privacy requirements

Before any CAP pilot:

- managed/registered device with operator authentication;
- encrypted device storage and transport;
- no permanent PHI cache, gallery save or notification preview by default;
- short inactivity timeout, explicit "End patient session", and cleanup on logout/restart;
- screenshot/download/printing restricted by policy and purpose;
- remote revocation/wipe capability for managed devices;
- visible patient-privacy mode so a non-clinical host cannot browse records;
- audit events for operator, access point, patient session, verification method, resource
  disclosure/action, time and outcome;
- safe low-connectivity behaviour: never present stale/unverified data as newly confirmed;
- abuse/rate-limit protections and lost/stolen-device response;
- privacy, clinical-safety and Uganda policy/legal review before field deployment.

## 7. Data model direction (future, not yet migrated)

Prefer extending shared Core primitives instead of CAP-only identity tables. Expected bounded
objects include:

- registered access points/devices;
- assisted-access sessions;
- patient/guardian verification challenges;
- consent/delegation grants;
- disclosure/audit events;
- device revocation and session-risk state.

Exact schema must be reconciled with the live Supabase schema before any additive migration.

## 8. Release sequencing

CAP is deliberately **not** on the current Pharm operational critical path.

### Gate A — Synapse Pharm operational first

A pharmacy pilot must complete, without manual repair:

`recruit/onboard pharmacy -> add staff -> receive batched stock -> inventory/expiry -> POS/dispense
-> payment -> receipt -> stock decrement -> refund/reversal -> reporting/audit`

The Expo pharmacy app must support ordinary day-to-day pharmacy work natively, with safe
connectivity degradation and no false-success offline writes.

### Gate B — Shared identity hardening

After the pharmacy pilot path is stable: consolidate Synapse ID, person/account/membership
relationships, capability vocabulary, consent/delegation and disclosure audit.

### Gate C — CAP pilot

Build the VHT/community device flow against the hardened Core; test with synthetic data first,
then conduct privacy, safety, usability and field-readiness review before any real-patient pilot.

## 9. Non-negotiables

- A patient number/QR is never sufficient authentication.
- An LC1 role never implies clinical authorization.
- No community operator gets a village-wide patient browser.
- No permanent patient data is stored on the community device by default.
- No sensitive result is exposed outside its approved disclosure/counselling workflow.
- Every disclosure is attributable and auditable.
- CAP must not create a second identity or clinical-record silo.
