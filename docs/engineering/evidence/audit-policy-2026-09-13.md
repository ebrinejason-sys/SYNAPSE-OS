# Hospital audit policy (RC1)

Environment: disposable-rc1 (not production / not LIVE_PROOF).

## Required vs best-effort

| Class | Helper | Client-visible success |
| --- | --- | --- |
| Clinical / security-sensitive state change | `requireHospitalAudit` | Forbidden unless the audit insert resolves |
| Telemetry / non-security reads | `logHospitalAudit` | Allowed if audit fails |

Required today:

- `POST /api/hospital/sync/apply` write-up, triage, prescribe, disposition
- `POST /api/lab/actions` for `verify` / `release` / `amend` (`LAB_RESULT_VERIFIED` / `LAB_REPORT_RELEASED` / `LAB_RESULT_AMENDED`)

Best-effort remains on non-transition paths (page views, list loads).

## Failure + retry

PostgREST cannot wrap encounter update + audit insert in one transaction.

1. Domain write may commit first.
2. If required audit fails, the route returns `503` / `AUDIT_REQUIRED_FAILED` / `outcome: retry` and **does not** set `ok: true`.
3. Server outbox stays `queued` with `conflict_reason=AUDIT_REQUIRED:…` (not `applied`).
4. Retry of the same command identity and payload hash re-enters apply (`classifyExisting` → `none` while not applied). Current retry mechanisms (not transactional guarantees):
   - write-up / disposition: same encounter columns overwritten
   - prescribe: `clinical_prescriptions` upsert on `id`
   - triage vitals: upsert on server-generated outbox ID as `vitals.id`, never the client-selected command ID
   - lab verify / release / collect: return current state if already at or past the target
   - lab amend: in-memory replay requires the same amendment ID, result, value, reason, and actor; HTTP adapter still generates a new ID and does not reload amendment history, so persisted retry safety is NOT established
   - billing: `idempotency_key` is resolved before `INVOICE_ALREADY_PAID`

Lost-ack after a successful audit+apply: outbox is `applied`, replay returns `outcome: replay` without rewriting the encounter.

## Shared-device / outbox wrap

Parked outbox wrap material is HMAC-SHA256 of `SYNAPSE_JWT_SECRET` over `tenantId|actorId`, issued only on authenticated context/write-up GETs. Another signed-in user receives different material and cannot unwrap. Residual: XSS or the same OS profile can still read origin storage.

## Lab actions retry

`POST /api/lab/actions` for verify/release/amend:

1. Domain write via `executeHospitalLabAction` may commit first.
2. If `requireHospitalAudit` fails, response is `503` with `code: AUDIT_REQUIRED_FAILED` and `outcome: retry` (no 200 body).
3. Verify/release/collect preserve domain state on retry. Collection's database adapter avoids creating a new specimen on a completed collection. Do not blindly retry amendments: persisted amendment idempotency still requires implementation and database acceptance.
