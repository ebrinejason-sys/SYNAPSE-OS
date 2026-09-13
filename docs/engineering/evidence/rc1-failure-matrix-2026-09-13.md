# RC1 failure matrix (HTTP + DB) — disposable

- Base: http://127.0.0.1:3011
- SHA: 19a7944
- When: 2026-09-13T08:16:10.229Z

- PASS writeup apply — {"ok":true,"outcome":"applied","commandId":"ff4eaa64-79ee-4d07-b9f1-d015d4bd12f3","serverAckId":"15f44590-c097-4aa9-8929-01103bb65551","checkpoint":"2026-09-13T08:16:07.631Z","result":{"encounterId":"
- PASS DB has writeup HPI after apply — matrix-hpi-1789287367360
- PASS lost-ack replay outcome — {"ok":true,"outcome":"replay","commandId":"ff4eaa64-79ee-4d07-b9f1-d015d4bd12f3","serverAckId":"15f44590-c097-4aa9-8929-01103bb65551","checkpoint":"2026-09-13T08:16:07.631+00:00","result":{"writeup":{
- PASS outbox tables present — offline_mutation_outbox
- PASS DB outbox row for commandId — offline_mutation_outbox:1
- PASS payload hash conflict — {"error":"Command id was already used with different content","outcome":"conflict","conflict":{"policy":"human_review","reason":"idempotency_mismatch"}}
- FAIL mark encounter signed for matrix — c3333333-3333-4333-8333-333333333301
UPDATE 1
- PASS signed encounter rejected — {"error":"Encounter is signed — sync refused","outcome":"rejected","reason":"ENCOUNTER_SIGNED_IMMUTABLE"}
- FAIL prescribe apply — {"error":"Could not find the table 'public.clinical_prescriptions' in the schema cache","outcome":"retry"}
- FAIL DB prescription count increased or stable applied — ERROR:ERROR:  relation "clinical_prescriptions" does not exist
LINE 1: select count(*)::text from clinical_prescriptions where tena...
                                   ^
→ERROR:ERROR:  relation "clinical_prescriptions" does not exist
LINE 1: select count(*)::text from clinical_prescriptions where tena...
                                   ^

- FAIL prescribe lost-ack replay — {"error":"Could not find the table 'public.clinical_prescriptions' in the schema cache","outcome":"retry"}
- PASS prescribe replay no duplicate — ERROR:ERROR:  relation "clinical_prescriptions" does not exist
LINE 1: select count(*)::text from clinical_prescriptions where tena...
                                   ^
→ERROR:ERROR:  relation "clinical_prescriptions" does not exist
LINE 1: select count(*)::text from clinical_prescriptions where tena...
                                   ^

- PASS tenant scope denied — 403 {"error":"Sync command scope mismatch"}

Facility-switch browser E2E still open (needs second facility session cookie).

## Honest gaps

- **Signed reject:** PASS (`ENCOUNTER_SIGNED_IMMUTABLE`) after setting `encounters.is_signed = true`.
- **Prescribe HTTP+DB:** FAIL on reduced disposable schema — `public.clinical_prescriptions` missing (PostgREST schema cache). Domain unit goldens still cover prescribe replay/conflict/signed; disposable schema expansion (RC1 step 2) must add this table before prescribe matrix can be LIVE_PROOF.
- **Facility-switch browser E2E:** still open (needs second facility session).

## Already strong

- Write-up apply + DB HPI persistence
- Lost-ack replay (`outcome: replay`) + single outbox row
- Payload-hash conflict (`idempotency_mismatch`)
- Tenant scope mismatch → 403
