# Repository audit — 2026-08-17 network foundations

Method: read-only inspection of `main` then additive implementation on `cursor/network-identity-foundations-e7a0`. Live Supabase was not mutated.

## Existing architecture (kept)

- Turborepo: `apps/web`, `apps/pharmacy`, `apps/app`, `packages/{auth,db,config,email,ui}`
- Custom JWT sessions (`@synapse/auth`), tenant isolation in APIs, RLS defense-in-depth
- Pharmacy POS via `complete_pharmacy_sale` RPC, batch-authoritative inventory
- Expo pharmacy screens + mobile BFF under `apps/web/src/app/api/mobile/**`
- `patient_timeline_events`, insurance claims/payer contracts, lab orders/results
- `patients` is a **facility chart** (`mrn` unique per tenant), not a platform person
- `pharmacy_customers` is a **pharmacy local customer**, not a person
- `@synapse/ui` previously exported only `cn()`
- Accessibility was partial (some `aria-label`s on POS; contrast tokens unverified)

## Gaps closed in this change

- Organization / facility mode / satellite columns
- Universal person + namespaced identifiers + MPI scoring (no auto-merge)
- Person-level profile facts with provenance
- Consent purposes, emergency profile, blood donation, insurance memberships
- Interoperability adapter package + lab specimen/accession tables
- Offline outbox contract
- Pharmacy branches API/UI, staff `store_id`, customer→person, timeline on identified sales
- Design-system contrast tokens, POS keyboard + live regions, Expo a11y props
