# Hospital Module Map — Phase 0 Registry

**Branch:** `hospital-build/phase-0-module-registry`  
**Date:** 2026-07-04  
**Purpose:** Ground-truth map of hospital departments → existing Supabase tables, `apps/web` API routes, and UI screens. Drives module gating via `hospital_modules`, `has_feature()`, and `has_capability()`.

## Module registry keys (FLAG-OFF by default)

| Module key | Department(s) | `has_feature()` key | Notes |
|---|---|---|---|
| `core` | Facility core, Platform | — | Always-on tenant shell; not subscription-gated |
| `registration` | Registration / HIM | `registration` | Patient registration, MRN, records merge |
| `opd` | OPD / Triage | `opd` | Outpatient queue, triage, walk-in |
| `clinical` | Doctor / Clinical | `opd` (bundled) | Encounters, SOAP, orders, consults |
| `ipd` | Nursing / IPD | `ipd` | Wards, beds, admissions, rounds |
| `lab` | Laboratory | `lab` | Orders, specimens, results, QC |
| `radiology` | Radiology | `radiology` | Imaging orders, reports, PACS hooks |
| `dispensing` | Hospital dispensing | `dispensing` | In-hospital drug orders; **not** pharmacy POS |
| `maternity` | Maternity | `maternity` | ANC, labour, partograph, postnatal |
| `immunization` | Immunization / Pediatrics | `immunization` | EPI schedule, growth, paediatric queue |
| `theatre` | Theatre / Surgery | `theatre` | OR schedule, checklists, implants |
| `emergency` | Emergency / Referrals | `emergency` | A&E triage, resus, facility referrals |
| `mortuary` | Mortuary | `mortuary` | Body register, release workflow |
| `support_ops` | Support ops | `support_ops` | Housekeeping, visitors, gas cylinders |
| `hr` | HR-lite | `hr` | Staff, attendance, schedules (lite) |
| `billing` | Revenue cycle | `billing` | Invoices, payments, patient billing |
| `claims` | Revenue cycle | `claims` | Insurance preauth, claims, appeals |
| `telemedicine` | Doctor / Clinical | `telemedicine` | Intake, appointments, video sessions |
| `reports` | All departments | `reports` | Operational & clinical reporting |
| `public_health` | Public health | `public_health` | Surveillance, DHIS2, outbreaks |
| `migration` | Migration | `migration` | CSV/XLSX import wizard |
| `platform` | Platform | — | Platform admin only; not tenant-scoped |

**Gating layers**

1. **Subscription:** `has_feature(tenant_id, feature_key)` — hospital plan features absent by default (FLAG-OFF).
2. **Tenant module toggle:** `hospital_modules` (`module_key`, `is_active`) — no rows seeded; enabled only at onboarding/provisioning.
3. **RBAC:** `has_capability(role, facility_type, module, resource, action)` — hospital capabilities seeded in migration `20260704120000_hospital_module_registry_seed.sql`.

---

## 1. Facility core

**Module keys:** `core`

### Existing tables
| Table | Role |
|---|---|
| `tenants` | Facility identity, slug, plan, facility_type |
| `hospitals` | Hospital profile, subdomain, settings JSON |
| `hospital_settings` | Name, currency, tax, contact |
| `hospital_modules` | Per-hospital module toggles |
| `departments` | Department catalog |
| `profiles` | Staff users, roles |
| `feature_flags` | Legacy per-tenant feature toggles |
| `audit_log`, `phi_access_log` | Audit trail |
| `platform_billing_config` | Module registry catalog (`hospital_module_registry` key) |

### API routes
| Route | Status |
|---|---|
| `GET/POST /api/platform/hospitals` | ✅ Exists — provisions tenant + optional modules |
| `GET /api/auth/me` | ✅ Exists |
| `GET /api/platform/health` | ✅ Exists |
| `GET/PATCH /api/account/profile` | ✅ Exists |
| `/api/admin/settings/*` | ❌ Missing — no dedicated hospital settings API |
| `/api/hospital/modules` | ❌ Missing — Phase 1 admin console |

### Screens (`apps/web`)
| Screen | Status |
|---|---|
| `/admin/settings`, `/admin/settings/branding`, `/admin/settings/domain` | ✅ Exists |
| `/admin/departments` | ✅ Exists |
| `/admin/page` | ✅ Exists |
| `/os/[slug]/dashboard` | ✅ Exists — tenant OS shell |
| `/os/[slug]/layout` | ✅ Exists |
| `/onboarding/*` | ✅ Exists — facility onboarding wizard |
| `/admin/hospital/modules` | ❌ Missing — Phase 1 |

---

## 2. Registration / HIM

**Module keys:** `registration`

### Existing tables
| Table | Role |
|---|---|
| `patients` | Core patient registry, MRN |
| `patient_profiles` | Extended demographics |
| `patient_consents` | Consent capture |
| `nin_access_log`, `passport_access_log` | ID access audit |
| `data_export_jobs`, `data_retention_policies` | HIM export/retention |
| `deidentification_profiles` | De-ID configs |

### API routes
| Route | Status |
|---|---|
| `GET/POST /api/mobile/patients` | ✅ Exists |
| `GET /api/mobile/patients/[id]` | ✅ Exists |
| `/api/patients/register` | ❌ Missing — web registration API |
| `/api/patients/merge` | ❌ Missing |

### Screens
| Screen | Status |
|---|---|
| `/os/[slug]/patients` | ✅ Exists |
| `/os/[slug]/patients/[id]` | ✅ Exists |
| `/patient/search` (via sidebar) | ⚠️ Referenced in nav; verify route |
| `/admin/staff/invite` | ✅ Exists (staff, not patients) |
| Dedicated HIM / records-merge UI | ❌ Missing |

---

## 3. OPD / Triage

**Module keys:** `opd`

### Existing tables
| Table | Role |
|---|---|
| `encounters` | OPD/IPD/EMERGENCY encounter types |
| `consult_queue` | Queue positions |
| `encounter_orders` | Orders from encounter |

### API routes
| Route | Status |
|---|---|
| `GET/POST /api/encounters` | ✅ Exists |
| `GET /api/mobile/queue` | ✅ Exists — mobile queue |
| `/api/opd/triage` | ❌ Missing |
| `/api/opd/queue` | ❌ Missing — web queue API |

### Screens
| Screen | Status |
|---|---|
| `/doctor/queue` | ✅ Exists |
| `/encounter/new`, `/encounter/[id]/*` | ✅ Exists |
| `/os/[slug]/encounters/new` | ✅ Exists |
| `/dept/ae/triage` | ✅ Exists — emergency triage (shared patterns) |
| Dedicated OPD triage screen | ❌ Missing — reuse A&E or Phase 1 |

---

## 4. Doctor / Clinical

**Module keys:** `clinical`, `telemedicine`

### Existing tables
| Table | Role |
|---|---|
| `encounters`, `encounter_diagnoses`, `encounter_orders` | Clinical workflow |
| `clinical_notes`, `clinical_note_embeddings` | Documentation + AI history |
| `prescriptions`, `hospital_drug_orders` | Medication orders |
| `vitals`, `app_vitals` | Vitals capture |
| `reasoning_sessions`, `reasoning_hypotheses`, `reasoning_evidence` | AI differential |
| `telemedicine_*` (8 tables) | Telehealth stack |
| `doctor_availability_log` | Scheduling |

### API routes
| Route | Status |
|---|---|
| `POST /api/copilot/encounter` | ✅ Exists — four-copilot read |
| `POST /api/ai/soap`, `/api/ai/diagnose`, `/api/ai/score` | ✅ Exists |
| `POST /api/tele/intake`, `/api/tele/chatbot` | ✅ Exists |
| `/api/clinical/encounters/[id]` | ❌ Missing — CRUD beyond stub |
| `/api/prescriptions` | ❌ Missing |

### Screens
| Screen | Status |
|---|---|
| `/doctor/*` (queue, consults, orders, rounds, tele, ai, schedule, notes, referrals, reports) | ✅ Exists |
| `/consults/new`, `/consults/[id]` | ⚠️ Stubs per design spec |
| `/encounter/[id]/*` | ✅ Exists |
| `/tele/*` | ✅ Exists |
| Full consultation workspace | ❌ Phase 1+ (per 2026-06-09 design spec) |

---

## 5. Nursing / IPD

**Module keys:** `ipd`

### Existing tables
| Table | Role |
|---|---|
| `hospital_beds`, `bed_assignments` | Bed management |
| `care_team_handovers`, `handover_*` | Shift handover |
| `vitals` | Nursing observations |
| `encounters` (type `IPD`) | Inpatient encounters |

### API routes
| Route | Status |
|---|---|
| `/api/ward/beds` | ❌ Missing |
| `/api/ward/admissions` | ❌ Missing |
| `/api/nursing/vitals` | ❌ Missing |

### Screens
| Screen | Status |
|---|---|
| `/nurse/ward`, `/nurse/beds`, `/nurse/vitals`, `/nurse/observations` | ✅ Exists |
| `/nurse/mar`, `/nurse/procedures`, `/nurse/handover` | ✅ Exists |
| `/admin/beds` | ✅ Exists |
| Ward board with live bed state API | ❌ Missing — UI shells only |

---

## 6. Laboratory

**Module keys:** `lab`

### Existing tables
| Table | Role |
|---|---|
| `lab_orders`, `lab_results`, `lab_test_results` | Order → result pipeline |
| `lab_instrument_bridges` | Instrument ingest |
| `loinc_reference` | Test catalog |

### API routes
| Route | Status |
|---|---|
| `POST /api/lab/instrument-ingest` | ✅ Exists |
| `POST /api/lab/notify` | ✅ Exists |
| `/api/lab/orders` | ❌ Missing |
| `/api/lab/results` | ❌ Missing |

### Screens
| Screen | Status |
|---|---|
| `/lab/orders`, `/lab/specimens`, `/lab/results`, `/lab/verify`, `/lab/qc`, `/lab/reports`, `/lab/instruments` | ✅ Exists |
| `/admin/lab` | ✅ Exists |

---

## 7. Radiology

**Module keys:** `radiology`

### Existing tables
| Table | Role |
|---|---|
| `imaging_studies`, `imaging_series` | Study/series |
| `radiology_reports`, `radiology_report_templates` | Reporting |

### API routes
| Route | Status |
|---|---|
| `/api/radiology/orders` | ❌ Missing |
| `/api/radiology/reports` | ❌ Missing |

### Screens
| Screen | Status |
|---|---|
| `/radiology/orders`, `/radiology/results`, `/radiology/reports` | ✅ Exists |

---

## 8. Hospital dispensing

**Module keys:** `dispensing`  
**Constraint:** Do **not** touch pharmacy POS money path (`apps/pharmacy`, `pharmacy_transactions`, POS APIs).

### Existing tables
| Table | Role |
|---|---|
| `hospital_drug_orders` | In-hospital dispensing orders |
| `pharmacy_orders`, `pharmacy_order_items` | Encounter-linked pharmacy |
| `drug_inventory`, `dispense_requests` | Stock + queue |
| `drug_interactions`, `medication_safety_checks` | Safety |

### API routes
| Route | Status |
|---|---|
| `POST /api/pharmacy/interactions` | ✅ Exists — interaction check only |
| `/api/dispensing/orders` | ❌ Missing |
| `/api/hospital/pharmacy/dispense` | ❌ Missing |

### Screens
| Screen | Status |
|---|---|
| `/pharmacy/dispense`, `/pharmacy/queue`, `/pharmacy/inventory` | ✅ Exists — legacy web pharmacy (not POS) |
| Hospital-specific dispense tied to `hospital_drug_orders` | ❌ Missing |

---

## 9. Maternity

**Module keys:** `maternity`

### Existing tables
| Table | Role |
|---|---|
| `maternity_records` | ANC/delivery records |
| `partograph_records` | Labour partograph |
| `encounters` (type `ANC`) | ANC encounters |

### API routes
| Route | Status |
|---|---|
| `/api/maternity/records` | ❌ Missing |
| `/api/maternity/partograph` | ❌ Missing |

### Screens
| Screen | Status |
|---|---|
| `/dept/maternity/anc`, `/dept/maternity/labour`, `/dept/maternity/postnatal` | ✅ Exists |

---

## 10. Immunization / Pediatrics

**Module keys:** `immunization`

### Existing tables
| Table | Role |
|---|---|
| `immunization_schedule` | EPI schedule |
| `aefi_reports` | Adverse events |
| `patient_profiles.immunizations` | JSON immunization history |

### API routes
| Route | Status |
|---|---|
| `/api/immunization/schedule` | ❌ Missing |
| `/api/immunization/administer` | ❌ Missing |

### Screens
| Screen | Status |
|---|---|
| `/dept/paediatrics/immunisation`, `/dept/paediatrics/growth`, `/dept/paediatrics/queue` | ✅ Exists |
| `/patient/immunisation` | ✅ Exists |

---

## 11. Theatre

**Module keys:** `theatre`

### Existing tables
| Table | Role |
|---|---|
| `surgery_schedules` | OR schedule + checklist columns |
| `encounters` (type `PROCEDURE`) | Procedure encounters |

### API routes
| Route | Status |
|---|---|
| `/api/theatre/schedule` | ❌ Missing |
| `/api/theatre/checklist` | ❌ Missing |

### Screens
| Screen | Status |
|---|---|
| `/dept/theatre/schedule`, `/dept/theatre/checklist` | ✅ Exists |

---

## 12. Emergency / Referrals

**Module keys:** `emergency`

### Existing tables
| Table | Role |
|---|---|
| `encounters` (type `EMERGENCY`, `acuity`) | Emergency encounters |
| `facility_referrals`, `cross_tenant_access` | Inter-facility referrals |

### API routes
| Route | Status |
|---|---|
| `POST /api/facility/referral` | ✅ Exists |
| `/api/emergency/triage` | ❌ Missing |

### Screens
| Screen | Status |
|---|---|
| `/dept/ae/triage`, `/dept/ae/resus` | ✅ Exists |
| `/referrals`, `/referrals/new`, `/referrals/incoming`, `/referrals/outgoing`, `/referrals/[id]` | ✅ Exists |
| `/doctor/referrals` | ✅ Exists |

---

## 13. Mortuary

**Module keys:** `mortuary`

### Existing tables
| Table | Role |
|---|---|
| `body_register` | Body admission, storage, release |
| `death_registrations`, `death_reports` | Death notification / MPDSR |

### API routes
| Route | Status |
|---|---|
| `/api/mortuary/register` | ❌ Missing |
| `/api/mortuary/release` | ❌ Missing |

### Screens
| Screen | Status |
|---|---|
| Mortuary UI | ❌ Missing — tables exist, no screens |

---

## 14. Support ops

**Module keys:** `support_ops`

### Existing tables
| Table | Role |
|---|---|
| `housekeeping_tasks` | Housekeeping |
| `visitor_log` | Visitor management |
| `gas_cylinders` | Medical gas tracking |
| `facility_resource_logs` | Resource logs |

### API routes
| Route | Status |
|---|---|
| `/api/support/housekeeping` | ❌ Missing |
| `/api/support/visitors` | ❌ Missing |

### Screens
| Screen | Status |
|---|---|
| Support ops UI | ❌ Missing |

---

## 15. HR-lite

**Module keys:** `hr`

### Existing tables
| Table | Role |
|---|---|
| `attendance_records`, `staff_shifts` | Attendance & shifts |
| `profiles` | Staff roster |

### API routes
| Route | Status |
|---|---|
| `/api/hr/attendance` | ❌ Missing |
| `/api/hr/schedules` | ❌ Missing |

### Screens
| Screen | Status |
|---|---|
| `/admin/hr`, `/admin/hr/attendance`, `/admin/hr/schedules`, `/admin/hr/payroll` | ✅ Exists |
| `/admin/staff`, `/admin/staff/invite` | ✅ Exists |

---

## 16. Revenue cycle

**Module keys:** `billing`, `claims`

### Existing tables
| Table | Role |
|---|---|
| `billing_invoices`, `billing_line_items`, `billing_payments` | Hospital billing |
| `invoices`, `payments`, `patient_billing` | Legacy/alternate billing |
| `insurance_claims`, `claim_line_items`, `insurance_preauthorizations` | Claims |
| `insurance_policies`, `insurance_benefits`, `insurance_coverage_checks` | Coverage |
| `denial_analytics_daily`, `payer_contracts` | Analytics |

### API routes
| Route | Status |
|---|---|
| `POST /api/billing/subscribe`, `/api/billing/verify`, `/api/billing/webhook/flutterwave` | ✅ Exists — **subscription** billing only |
| `POST /api/insurance/check`, `/api/insurance/claim`, `/api/insurance/appeal` | ✅ Exists |
| `/api/billing/invoices` | ❌ Missing — clinical invoicing |
| `/api/billing/payments` | ❌ Missing |

### Screens
| Screen | Status |
|---|---|
| `/admin/finance`, `/admin/finance/invoices`, `/admin/finance/payments` | ✅ Exists |
| `/admin/insurance`, `/admin/insurance/claims`, `/admin/insurance/appeals` | ✅ Exists |
| `/patient/bills` | ✅ Exists |
| `/onboarding/billing` | ✅ Exists |

---

## 17. Public health

**Module keys:** `public_health`

### Existing tables
| Table | Role |
|---|---|
| `surveillance_reports` | Community surveillance |
| `dhis2_export_log` | DHIS2 export audit |
| `outreach_campaigns`, `chw_visits`, `community_health_workers` | Community health |

### API routes
| Route | Status |
|---|---|
| `POST /api/surveillance/report` | ✅ Exists |
| `/api/public-health/dhis2/export` | ❌ Missing — platform uses server actions |

### Screens
| Screen | Status |
|---|---|
| `/epidemiology`, `/epidemiology/alerts`, `/epidemiology/outbreaks`, `/epidemiology/dhis2` | ✅ Exists |
| `/platform/public-health`, `/platform/dhis2` | ✅ Exists |
| `/dept/community/chw`, `/dept/community/map` | ✅ Exists |

---

## 18. Migration

**Module keys:** `migration`

### Existing tables
| Table | Role |
|---|---|
| `import_batches`, `import_batch_rows`, `import_column_mappings` | Generic import pipeline |
| `pharmacy_import_sessions` | Pharmacy-specific import (separate) |

### API routes
| Route | Status |
|---|---|
| `POST /api/import/start`, `/api/import/upload`, `/api/import/execute` | ✅ Exists |
| `GET /api/import/status/[batchId]` | ✅ Exists |

### Screens
| Screen | Status |
|---|---|
| `/os/[slug]/migrate` | ✅ Exists |

---

## 19. Platform

**Module keys:** `platform` (platform_admin only)

### Existing tables
| Table | Role |
|---|---|
| `tenants`, `hospitals`, `hospital_leads` | Tenant lifecycle |
| `subscription_plans`, `plan_features`, `tenant_subscriptions` | Billing spine |
| `support_tickets`, `support_ticket_events` | Support |
| `platform_flags`, `feature_flags` | Feature toggles |

### API routes
| Route | Status |
|---|---|
| `GET/POST /api/platform/hospitals` | ✅ Exists |
| `GET /api/platform/search`, `/api/platform/health` | ✅ Exists |
| `POST /api/platform/impersonate`, `/api/platform/security/unlock` | ✅ Exists |
| `GET/POST /api/platform/pharmacies` | ✅ Exists — pharmacy provisioning |

### Screens
| Screen | Status |
|---|---|
| `/platform/*` (32 routes) | ✅ Exists — command center |
| `/platform/hospitals`, `/platform/hospitals/new`, `/platform/hospitals/[id]` | ✅ Exists |
| `/platform/tenants/provision` | ✅ Exists |
| `/platform/feature-flags`, `/platform/flags` | ✅ Exists |

---

## Phase 0 → Phase 1 readiness

### Ready for Phase 1 (hospital admin console)
- Module registry catalog seeded in `platform_billing_config` (`hospital_module_registry`)
- Hospital capabilities + role grants seeded (idempotent)
- Hospital subscription plan shells (`hospital_starter`, `hospital_professional`, `hospital_enterprise`) with **zero** `plan_features`
- Ground-truth module map (this document)
- Existing platform hospital provisioning (`POST /api/platform/hospitals`) already writes `hospital_modules` when modules passed in body

### Gaps / blockers
| Gap | Impact | Phase |
|---|---|---|
| No `/admin/hospital/modules` UI | Cannot toggle modules from hospital admin | Phase 1 |
| Most department APIs missing | Screens are largely UI shells without data wiring | Phase 1–3 |
| `capabilities` / `role_capabilities` not in repo migrations until Phase 0 seed | Local `db reset` may lack lattice tables | Phase 0 migration fixes |
| Consult workspace stubs | Core doctor product incomplete | Phase 2+ |
| Mortuary + support ops — zero screens | Tables exist, no UX | Phase 3+ |
| `hospital_modules` not auto-seeded for existing tenants | FLAG-OFF intentional; activation is explicit | Phase 1 provisioning |
| Pharmacy POS path isolated | Hospital dispensing must not call POS APIs | Ongoing constraint |

### Proof gate (run after migration apply)

```sql
-- 1. Module registry catalog
SELECT key, jsonb_array_length(value) AS module_count
FROM platform_billing_config
WHERE key = 'hospital_module_registry';

-- 2. Hospital capabilities seeded (expect >= 40 new hospital-module rows)
SELECT module, resource, action, description
FROM capabilities
WHERE module IN (
  'opd','ipd','ward','lab','radiology','maternity','theatre','mortuary',
  'billing','dispensing','telemedicine','reports','migrate','registration',
  'emergency','immunization','public_health','hr','support'
)
ORDER BY module, resource, action;

-- 3. Role grants for hospital facility type
SELECT rc.role, rc.facility_type, c.module, c.resource, c.action
FROM role_capabilities rc
JOIN capabilities c ON c.id = rc.capability_id
WHERE rc.facility_type IN ('hospital', 'any')
  AND c.module IN ('opd','ipd','ward','lab','radiology','maternity','theatre','mortuary','billing','migrate')
ORDER BY rc.role, c.module;

-- 4. Hospital plans exist with ZERO features (FLAG-OFF)
SELECT p.slug, p.facility_type, COUNT(pf.id) AS feature_count
FROM subscription_plans p
LEFT JOIN plan_features pf ON pf.plan_id = p.id
WHERE p.facility_type = 'hospital'
GROUP BY p.slug, p.facility_type;

-- 5. No tenant module activations seeded (FLAG-OFF)
SELECT COUNT(*) AS active_hospital_modules FROM hospital_modules WHERE is_active = true;

-- 6. Zero non-config transaction rows from this migration
SELECT COUNT(*) AS new_encounters FROM encounters WHERE created_at > now() - interval '5 minutes';
SELECT COUNT(*) AS new_invoices FROM billing_invoices WHERE created_at > now() - interval '5 minutes';
```

**Expected results:** module_count ≥ 20; hospital capabilities present; hospital plans with feature_count = 0; active_hospital_modules unchanged (0 if none existed); transaction counts = 0.
