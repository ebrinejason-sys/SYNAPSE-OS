# RC1 failure matrix (HTTP + DB) — disposable

- Base: http://127.0.0.1:3011
- SHA: 120d176
- When: 2026-09-13T08:32:01.549Z

- PASS writeup apply — {"ok":true,"outcome":"applied","commandId":"feafa774-eb54-45e5-922e-73ff07636f16","serverAckId":"6de3a707-520a-4b33-b7c1-e444471121f5","checkpoint":"2026-09-13T08:31:58.919Z","result":{"encounterId":"
- PASS DB has writeup HPI after apply — matrix-hpi-1789288316872
- PASS lost-ack replay outcome — {"ok":true,"outcome":"replay","commandId":"feafa774-eb54-45e5-922e-73ff07636f16","serverAckId":"6de3a707-520a-4b33-b7c1-e444471121f5","checkpoint":"2026-09-13T08:31:58.919+00:00","result":{"writeup":{
- PASS outbox tables present — offline_mutation_outbox
- PASS DB outbox row for commandId — offline_mutation_outbox:1
- PASS payload hash conflict — {"error":"Command id was already used with different content","outcome":"conflict","conflict":{"policy":"human_review","reason":"idempotency_mismatch"}}
- PASS signed encounter rejected — {"error":"Encounter is signed — sync refused","outcome":"rejected","reason":"ENCOUNTER_SIGNED_IMMUTABLE"}
- PASS prescribe apply — {"ok":true,"outcome":"applied","commandId":"c5596fa9-f147-423e-b239-550c03fccb79","serverAckId":"f8321353-4b87-4282-a826-fa149446c3c9","checkpoint":"2026-09-13T08:32:00.766Z","result":{"encounterId":"
- PASS DB prescription count increased or stable applied — 2→3
- PASS prescribe lost-ack replay — {"ok":true,"outcome":"replay","commandId":"c5596fa9-f147-423e-b239-550c03fccb79","serverAckId":"f8321353-4b87-4282-a826-fa149446c3c9","checkpoint":"2026-09-13T0
- PASS prescribe replay no duplicate — 3→3
- PASS tenant scope denied — 403 {"error":"Sync command scope mismatch"}

Facility-switch browser E2E still open (needs second facility session cookie).

## Reaffirm (120d176)

Re-ran `npx tsx scripts/rc1-failure-matrix.mjs` → SUMMARY fail=0 total=12.
