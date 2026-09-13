---
result: PASS
environment: disposable-rc1
sha: 090ae645d57c671b5c11f5913d015cc524bf4009
scope: http-lab-actions+sync-apply-writeup
recordedAt: 2026-09-13T06:13:39Z
proofKind: http
browserJourney: NOT_VERIFIED
---

# Disposable RC1 HTTP acceptance (2026-09-13)

## Environment
- Branch: `feat/rc1-lab-offline-acceptance`
- Disposable Postgres docker label `synapse.disposable-test=true`
- PostgREST `synapse-rc1-postgrest` + local `/rest/v1` Node proxy on `127.0.0.1:54322`
- Next.js `127.0.0.1:3011` with gitignored `apps/web/.env.local` (not committed)
- Pilot/production Supabase **not** touched

## Lab HTTP journey (authenticated sessions) — PASS
Order `d4444444-...` → collect → receive → reject (`hemolyzed`) →
replacement `22ef2ece-...` (`replacesLabOrderId` set) → collect → receive →
enter_result → verify → release → amend (`result_value=Negative`, `status=corrected`, `version=2`).
Reports: FINAL v1 + AMENDED v2 in `lab_reports`.
All lab actions returned `source: "database"`.

## Offline write-up HTTP (sync/apply) — PASS
- `GET /api/hospital/sync/context` → doctor syncContext
- `GET /api/opd/encounters/{id}/write-up` → includes `syncContext`
- `POST /api/hospital/sync/apply` with `clinical.encounter.writeup.v1` → `outcome: applied`; encounter metadata writeup HPI/plan persisted

## Explicitly NOT verified
- Full **browser** UI lab journey (Playwright/manual clicks)
- Browser offline localStorage encrypt/park/reload/reconnect UX
- Prescribe offline UI end-to-end
- RLS as end-user JWT (service-role used for PostgREST admin client as in production app pattern)
- Pilot/live cloud acceptance

## Tooling notes
- Next failed to boot until `api/opd/encounters/[encounterId]` merged into `[id]` (slug name clash)
- `logHospitalAudit` no longer calls `.catch` on a PostgREST builder (try/catch)
- Disposable schema needed `lab_results.entered_by/result_source/released_to_patient_at` and `encounters.clinical_stage` for persist/apply
