# RC1 audit-fail retry safety — 2026-09-15

Branch: `feat/rc1-lab-offline-acceptance`

Disposable HTTP+DB matrix (`scripts/rc1-failure-matrix.mjs`) was not re-run this day: the labeled `synapse-rc1-lab-*` stack is not running. Retry safety is proven in-process:

| Case | Proof | Result |
|---|---|---|
| Lab verify retry after committed write | `npm run test:lab-workflow-retry` | PASS |
| Lab release retry | same | PASS |
| Lab amend same-ID/content replay (in-memory only) | same | PASS |
| Lab collect retry (in-memory identifiers) | same | PASS |
| Triage stable vitals ID | `test:clinical-offline-triage` + mocked sync/apply; server outbox UUID | PASS |
| Prescribe upsert on `id` | existing persist helper + prescribe golden | PASS |
| Billing idempotency before ALREADY_PAID | `npm run test:clinical-payment` | PASS |
| Sync/apply 503 when audit fails | `test:hospital-sync-apply` | PASS |
| Lab actions 503 when audit fails | `test:lab-actions` | PASS |

Domain write may still commit before audit. Client-visible success remains forbidden until audit resolves. Retry must not duplicate results, amendments, vitals, prescriptions, or payments.

Review correction (2026-09-16): the HTTP amendment adapter generates a new amendment ID per request and does not hydrate amendment history. Domain PASS does not establish HTTP/DB amendment retry safety. Collection adapter retry has separate mocked regression coverage; no new live failure matrix was run. EHR continuity is a fixture-level simulation, not RLS or consent acceptance. The onboarding script is restricted to explicit disposable loopback targets and produces service-role smoke evidence only.
