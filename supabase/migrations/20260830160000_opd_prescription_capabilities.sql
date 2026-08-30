-- OPD prescription capabilities for hospital clinical journey (Step 4)

INSERT INTO capabilities (module, resource, action, description)
SELECT v.module, v.resource, v.action, v.description
FROM (VALUES
  ('opd', 'prescription', 'create', 'Create clinical prescription'),
  ('opd', 'prescription', 'read',   'View clinical prescriptions'),
  ('dispensing', 'prescription', 'verify',   'Verify clinical prescription'),
  ('dispensing', 'prescription', 'dispense', 'Dispense clinical prescription')
) AS v(module, resource, action, description)
WHERE NOT EXISTS (
  SELECT 1 FROM capabilities c
  WHERE c.module = v.module AND c.resource = v.resource AND c.action = v.action
);

SELECT _grant_hospital_cap('doctor', 'hospital', 'opd', 'prescription', 'create');
SELECT _grant_hospital_cap('doctor', 'hospital', 'opd', 'prescription', 'read');
SELECT _grant_hospital_cap('clinical_officer', 'hospital', 'opd', 'prescription', 'create');
SELECT _grant_hospital_cap('clinical_officer', 'hospital', 'opd', 'prescription', 'read');
SELECT _grant_hospital_cap('pharmacist', 'hospital', 'dispensing', 'prescription', 'verify');
SELECT _grant_hospital_cap('pharmacist', 'hospital', 'dispensing', 'prescription', 'dispense');
SELECT _grant_hospital_cap('pharmacist', 'hospital', 'opd', 'prescription', 'read');
