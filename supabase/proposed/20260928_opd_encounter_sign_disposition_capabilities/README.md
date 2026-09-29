# PROPOSED: OPD clinician and nursing capabilities (not auto-applied)

Root cause: these routes call `requireHospitalCapability(ctx, resource, action, 'opd')`
for capability rows that no migration creates, so `has_capability` is false for every
role (production confirmed read-only: none of the triples exist):

| Route | Capability |
| --- | --- |
| `POST /api/opd/encounters/[id]/sign` | `opd.encounter.sign` |
| `POST /api/opd/encounters/[id]/disposition` | `opd.encounter.disposition` |
| `POST /api/opd/encounters/[id]/close` | `opd.encounter.close` |
| `POST /api/opd/results/[resultId]/review` | `opd.result.review` |
| `POST /api/opd/prescriptions/[id]/cancel` | `opd.prescription.cancel` |
| `POST /api/lab/orders/[id]/cancel` | `lab.order.cancel` |

Grants (facility type `hospital`):

- `doctor`, `clinical_officer`: all six capabilities above. Clinical officers are
  authorized clinicians for encounter, diagnosis, prescription, sign and disposition.
- `lab_scientist`: `lab.order.cancel`. Without any cancel grant a duplicate or mistaken
  Lab order can never be withdrawn, so its task stays open and its charge stays on the
  invoice. Cancelling voids the unpaid charge.
- `doctor`, `clinical_officer`: `opd.queue.read` (`GET /api/opd/queue`, encounter timeline,
  task list) and `lab.order.read` (`GET /api/opd/lab-orders`). Both capabilities exist, but
  production grants them only to `receptionist` and lab roles respectively, so clinicians
  cannot see their queue or their own lab orders.
- `nurse`: `opd.triage.assign` and `opd.queue.read` (existing capabilities). Outpatient
  triage and vitals are OPD nursing work; production grants `opd.triage.assign` to
  `doctor` only, so nurses cannot record OPD vitals or acuity.

Not granted (role separation):

- `receptionist`: opens a visit with `opd.encounter.create` (already granted); since
  `/api/opd/triage` now requires `opd.triage.assign` only when acuity or vitals are
  sent, reception can route a patient to the queue without triaging.
- `cashier` / `billing_officer`: payments use `billing.payment.record`, already held by
  `billing_officer` (the "Cashier" position maps to that role).

Still ungranted, product decisions (routes stay 403):

- `dispensing.inventory.write` (hospital stock purchasing counts as advanced inventory,
  which OS Basic does not include)

Apply: `\i up.sql` (idempotent). Rollback: `\i down.sql`. If an environment already
granted the nurse capabilities before `up.sql`, skip the nurse block of `down.sql`.
