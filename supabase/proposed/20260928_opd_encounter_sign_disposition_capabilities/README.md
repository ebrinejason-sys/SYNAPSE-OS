# PROPOSED: OPD encounter sign/disposition capabilities (not auto-applied)

Root cause: the sign and disposition routes call
`requireHospitalCapability(ctx, 'encounter', 'sign'|'disposition', 'opd')`, but no
migration creates those capability rows, so `has_capability` is false for every
role (production confirmed read-only: neither triple exists).

Grants only doctor, matching repo evidence (E2E lattice + route semantics).

PRODUCT DECISION REQUIRED (not in this seed):
- clinical_officer sign/disposition
- receptionist `opd.triage.assign` (reception cannot open an OPD visit via triage)
- nurse `opd.encounter.create` (nurse cannot open a visit)
- cashier `billing.payment.record` (only billing_officer can record payments)

Apply: `\i up.sql` (idempotent). Rollback: `\i down.sql`.
