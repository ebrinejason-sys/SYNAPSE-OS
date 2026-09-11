# Clinical write-up (Hospital Pilot RC1) — 2026-09-11

## Scope
Structured doctor encounter write-up: HPI, PMH, medications, allergies, family/social, ROS, examination, assessment, plan.

## Layers shipped
1. **Domain** — `@synapse/db/clinical-writeup` (normalize, merge into `encounters.metadata.writeup`, compose signed-ready narrative, completeness).
2. **HTTP** — `GET`/`PUT` `/api/opd/encounters/[id]/write-up` (capability `opd/encounter/create`, blocks edits after sign, syncs `metadata.clinical_note`).
3. **UI** — `/encounter/[id]/notes` clinical write-up workspace; encounter hub + sign page no longer stubs.
4. **Evidence** — domain unit tests + Vitest route tests.

## Not yet proven
- Live synthetic journey that saves a full write-up then signs against production Supabase.
- Amendment of structured write-up fields after sign (amend today covers chief_complaint / clinical_stage / clinical_note narrative).
- Billing/disposition coherence into one end-to-end Hospital Golden Journey runner.

## How to run
```bash
npm run test:clinical-writeup
# route tests (from apps/web vitest suite)
npx vitest run src/app/api/opd/encounters/[id]/write-up/route.test.ts
```
