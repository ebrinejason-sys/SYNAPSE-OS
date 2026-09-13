# RC1 failure matrix (HTTP + DB) — disposable

- Base: http://127.0.0.1:3011
- SHA: 395f7a0
- When: 2026-09-13T08:17:56.911Z

- PASS writeup apply — {"ok":true,"outcome":"applied","commandId":"8f19e763-88cc-4893-82ac-130760c66a96","serverAckId":"838032c0-321b-4e7c-868d-7bcacaee77e8","checkpoint":"2026-09-13T08:17:53.595Z","result":{"encounterId":"
- PASS DB has writeup HPI after apply — matrix-hpi-1789287473278
- PASS lost-ack replay outcome — {"ok":true,"outcome":"replay","commandId":"8f19e763-88cc-4893-82ac-130760c66a96","serverAckId":"838032c0-321b-4e7c-868d-7bcacaee77e8","checkpoint":"2026-09-13T08:17:53.595+00:00","result":{"writeup":{
- PASS outbox tables present — offline_mutation_outbox
- PASS DB outbox row for commandId — offline_mutation_outbox:1
- PASS payload hash conflict — {"error":"Command id was already used with different content","outcome":"conflict","conflict":{"policy":"human_review","reason":"idempotency_mismatch"}}
- PASS signed encounter rejected — {"error":"Encounter is signed — sync refused","outcome":"rejected","reason":"ENCOUNTER_SIGNED_IMMUTABLE"}
- PASS prescribe apply — {"ok":true,"outcome":"applied","commandId":"9830ddcd-a799-4511-a554-70de686e5a62","serverAckId":"d204ff12-4d5d-4f3a-90e9-90c1ab8eebfb","checkpoint":"2026-09-13T08:17:56.198Z","result":{"encounterId":"
- PASS DB prescription count increased or stable applied — 1→2
- PASS prescribe lost-ack replay — {"ok":true,"outcome":"replay","commandId":"9830ddcd-a799-4511-a554-70de686e5a62","serverAckId":"d204ff12-4d5d-4f3a-90e9-90c1ab8eebfb","checkpoint":"2026-09-13T0
- PASS prescribe replay no duplicate — 2→2
- PASS tenant scope denied — 403 {"error":"Sync command scope mismatch"}

Facility-switch browser E2E still open (needs second facility session cookie).
