-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260907123159  name: backfill_canonical_hospital_locations
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Restore the canonical synthetic hospital's structured locations.
-- The tenant is resolved by its deterministic slug so no generated identifier is embedded.

with location_seed(code, name, location_type, department_name, parent_code, floor, building) as (
  values
    ('main_reception', 'Main Reception', 'reception', 'Reception / Registration / Medical Records', null, null, null),
    ('opd_triage', 'OPD Triage', 'triage', 'Triage', 'main_reception', null, null),
    ('opd_consult_1', 'OPD Consultation Room 1', 'consultation', 'Outpatient Department', 'opd_triage', null, null),
    ('opd_consult_2', 'OPD Consultation Room 2', 'consultation', 'Outpatient Department', 'opd_triage', null, null),
    ('ed_bay_1', 'Emergency Bay 1', 'bay', 'Emergency Department', null, null, null),
    ('ed_bay_2', 'Emergency Bay 2', 'bay', 'Emergency Department', null, null, null),
    ('ed_resus', 'Resuscitation Room', 'resuscitation', 'Emergency Department', 'ed_bay_1', null, null),
    ('medical_ward', 'Medical Ward', 'ward', 'Inpatient Medical Ward', null, 2, 'Block A'),
    ('surgical_ward', 'Surgical Ward', 'ward', 'Surgical Ward', null, 3, 'Block A'),
    ('paediatric_ward', 'Paediatric Ward', 'ward', 'Paediatric Ward', null, 2, 'Block B'),
    ('maternity_ward', 'Maternity Ward', 'ward', 'Maternity Ward', null, 1, 'Block C'),
    ('anc_clinic', 'ANC Clinic', 'clinic', 'Antenatal Clinic', null, null, null),
    ('lab_reception', 'Lab Reception', 'reception', 'Laboratory', null, null, null),
    ('phlebotomy', 'Phlebotomy', 'collection', 'Laboratory', 'lab_reception', null, null),
    ('hematology_bench', 'Hematology Bench', 'bench', 'Laboratory', 'lab_reception', null, null),
    ('chemistry_bench', 'Chemistry Bench', 'bench', 'Laboratory', 'lab_reception', null, null),
    ('microbiology_bench', 'Microbiology Bench', 'bench', 'Laboratory', 'lab_reception', null, null),
    ('rad_reception', 'Radiology Reception', 'reception', 'Radiology / Imaging', null, null, null),
    ('xray_room', 'X-Ray Room', 'imaging', 'Radiology / Imaging', 'rad_reception', null, null),
    ('ultrasound_room', 'Ultrasound Room', 'imaging', 'Radiology / Imaging', 'rad_reception', null, null),
    ('main_pharmacy', 'Main Pharmacy', 'pharmacy', 'Pharmacy', null, null, null),
    ('ed_pharmacy', 'Emergency Pharmacy', 'pharmacy', 'Pharmacy', 'main_pharmacy', null, null),
    ('main_theatre', 'Main Theatre', 'theatre', 'Theatre / Operating Room', null, null, null),
    ('recovery', 'Recovery', 'recovery', 'Theatre / Operating Room', 'main_theatre', null, null),
    ('billing_desk', 'Billing Desk', 'desk', 'Billing / Cashier', null, null, null),
    ('insurance_desk', 'Insurance Desk', 'desk', 'Insurance / Claims', null, null, null),
    ('stores', 'Stores', 'warehouse', 'Stores / Procurement', null, null, null)
), canonical_tenant as (
  select id from public.tenants where slug = 'synapse-integrated-demo' and is_synthetic = true
)
insert into public.facility_locations (
  tenant_id, hospital_id, department_id, code, name, location_type,
  floor, building, is_active, is_synthetic
)
select
  tenant.id,
  tenant.id,
  department.id,
  seed.code,
  seed.name,
  seed.location_type,
  seed.floor,
  seed.building,
  true,
  true
from location_seed seed
cross join canonical_tenant tenant
left join public.departments department
  on department.tenant_id = tenant.id and department.name = seed.department_name
on conflict (tenant_id, code) do update set
  hospital_id = excluded.hospital_id,
  department_id = excluded.department_id,
  name = excluded.name,
  location_type = excluded.location_type,
  floor = excluded.floor,
  building = excluded.building,
  is_active = true,
  is_synthetic = true,
  updated_at = now();

with parent_links(code, parent_code) as (
  values
    ('opd_triage', 'main_reception'),
    ('opd_consult_1', 'opd_triage'),
    ('opd_consult_2', 'opd_triage'),
    ('ed_resus', 'ed_bay_1'),
    ('phlebotomy', 'lab_reception'),
    ('hematology_bench', 'lab_reception'),
    ('chemistry_bench', 'lab_reception'),
    ('microbiology_bench', 'lab_reception'),
    ('xray_room', 'rad_reception'),
    ('ultrasound_room', 'rad_reception'),
    ('ed_pharmacy', 'main_pharmacy'),
    ('recovery', 'main_theatre')
), canonical_tenant as (
  select id from public.tenants where slug = 'synapse-integrated-demo' and is_synthetic = true
)
update public.facility_locations child
set parent_id = parent.id, updated_at = now()
from parent_links link
cross join canonical_tenant tenant
join public.facility_locations parent
  on parent.tenant_id = tenant.id and parent.code = link.parent_code
where child.tenant_id = tenant.id and child.code = link.code;

update public.hospital_seed_registry registry
set location_count = (
  select count(*) from public.facility_locations location where location.tenant_id = registry.tenant_id
), updated_at = now()
where registry.slug = 'synapse-integrated-demo' and registry.is_synthetic = true;
