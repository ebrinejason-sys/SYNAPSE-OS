# Manual acceptance — Lab + Offline (Hospital Pilot RC1)

Use **disposable/synthetic** facilities and patients only. Do **not** run against production PHI.
Do **not** treat service-role scripts as auth/RLS proof.

## Prerequisites
- Two synthetic hospital tenants (A/B)
- Roles: ordering clinician (doctor), specimen collector / lab_tech, lab_scientist (verify/release), facility admin
- Migration `20260913010000_lab_order_replacement_link.sql` applied on the disposable DB
- Known HEAD SHA recorded in the evidence note

## Lab (browser → authenticated API → DB)

1. Sign in as doctor on facility A; open/create synthetic encounter; place lab order.
2. Confirm order on facility A worklist; absent on facility B worklist.
3. As lab_tech: collect → receive; confirm accession/specimen/actor consistency after reload.
4. Reject with reason `hemolyzed`; confirm cannot enter result on rejected order.
5. Place replacement order with `replacesLabOrderId` (when UI exposes it) or via API; collect replacement; confirm original rejection retained.
6. Enter result; confirm draft not shown as released to clinician review.
7. As lab_tech attempt verify → expect 403; as lab_scientist verify → release.
8. Confirm clinician review task / close-gate blocks while unreviewed.
9. Amend released result; confirm FINAL then AMENDED report; prior value retained; other facility cannot fetch report by ID.
10. Record TAT timestamps (ordered/collected/received/released); note calculation uses those fields — not a clinical SLA unless configured.

### Negative
- Unauthenticated `/api/lab/actions` → 401
- Cross-tenant orderId substitution → not found / forbidden
- Duplicate collect/retry does not duplicate specimen rows unexpectedly

Mark each step PASS / FAIL / BLOCKED with SHA + environment.

## Offline clinical recovery (write-up)

1. Sign in; open encounter notes; confirm `syncContext` present (network tab on GET write-up).
2. DevTools → Offline; edit write-up; Save → must show **queued / not server-saved** (never “Last server-saved” alone).
3. Reload while offline; pending count remains for same user.
4. Logout (or clear session); ensure another user session does not see prior user’s queue key (`synapse.hospital.clinical.outbox.v1:<tenant>:<actor>`).
5. Reconnect as original user; load notes → flush; confirm server write-up matches; pending clears.
6. Replay: queue same commandId twice → applied once.
7. Conflict: same commandId different payload → conflict state surfaced.
8. Signed encounter while offline → flush must reject; item not silently lost.

## Recording
Attach screenshots/HAR only with synthetic IDs. Update scorecard LIVE_PROOF only after this procedure PASSes on a named disposable environment at a cited SHA.
