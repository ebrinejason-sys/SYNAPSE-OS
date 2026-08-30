# Hospital Staff RBAC Matrix — 2026-08-30

**Hospital:** SYNAPSE INTEGRATED REGIONAL HOSPITAL  
**Staff accounts:** 33 synthetic roles (provisioned, no plaintext passwords in repo)

## Capability model

RBAC uses four layers (see baseline audit):
1. `profiles.role` — base role
2. `has_capability(role, facility_type, module, resource, action)` — capability lattice
3. `staff_scope_assignments` — org/tenant/site/department scope
4. Subscription + module toggles via `has_feature()` and `hospital_modules`

## Staff roles and capabilities

| Role | Department | Capabilities | Auth test | Landing page |
|---|---|---|---|---|
| Hospital Administrator | administration | staff.manage, facility.manage, module.manage | PARTIAL | NOT_IMPLEMENTED |
| Medical Superintendent | administration | encounter.read/write, staff.manage | PARTIAL | NOT_IMPLEMENTED |
| Records Officer | him | patient.search, patient.register, demographics.update | PARTIAL | NOT_IMPLEMENTED |
| Receptionist | reception | patient.search/register, appointment.read, queue.create | PARTIAL | NOT_IMPLEMENTED |
| Triage Nurse | triage | patient.read, observation.create, triage.create, task.update | PARTIAL | NOT_IMPLEMENTED |
| OPD Nurse | opd | patient.read, observation.create, task.update | PARTIAL | NOT_IMPLEMENTED |
| OPD Doctor | opd | encounter, diagnosis, orders, prescription, pathway | PARTIAL | NOT_IMPLEMENTED |
| Emergency Nurse | emergency | patient.read, observation.create, triage.create | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Emergency Doctor | emergency | encounter, diagnosis, orders, prescription, pathway | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Internal Medicine Doctor | medicine | encounter, diagnosis, orders, prescription, pathway | PARTIAL | NOT_IMPLEMENTED |
| Surgeon | surgery | encounter, diagnosis, orders | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Lab Scientist / Verifier | laboratory | lab.result.review, verify, amend | PARTIAL | NOT_IMPLEMENTED |
| Phlebotomist | laboratory | lab.order.read, lab.specimen.collect | PARTIAL | NOT_IMPLEMENTED |
| Lab Technician | laboratory | lab.specimen.receive, lab.result.enter | PARTIAL | NOT_IMPLEMENTED |
| Pharmacist | pharmacy | prescription.read/verify, medication.dispense | PARTIAL | NOT_IMPLEMENTED |
| Cashier | billing | invoice.read, payment.collect | PARTIAL | NOT_IMPLEMENTED |
| Insurance Officer | insurance | coverage.check, claim.prepare/review | PARTIAL | NOT_IMPLEMENTED |
| Referral Coordinator | referral | patient.read, encounter.read | PARTIAL | NOT_IMPLEMENTED |
| Public Health Officer | public_health | aggregate.read, report.prepare | NOT_IMPLEMENTED | NOT_IMPLEMENTED |

## Negative permission tests (required, NOT_IMPLEMENTED)

| Actor | Must NOT be able to | Test status |
|---|---|---|
| Receptionist | Verify lab result | NOT_IMPLEMENTED |
| Lab technician | Prescribe medication | NOT_IMPLEMENTED |
| Cashier | Edit diagnosis | NOT_IMPLEMENTED |
| Platform admin | View clinical notes automatically | NOT_IMPLEMENTED |
| Pharmacist | Amend physician diagnosis | NOT_IMPLEMENTED |
| Clinician | Alter POS stock directly | NOT_IMPLEMENTED |

## Synthetic account provisioning

Staff emails follow pattern: `synthetic.{role_code}@synapse-integrated-demo.synapseos.local`  
Registration numbers: `SYN-{ROLE_CODE}-20260830`  
All accounts marked `is_synthetic: true`, `accountState: provisioned`  
Passwords must be provisioned at runtime — never committed to Git.
