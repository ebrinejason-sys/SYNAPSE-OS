-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260503175518  name: seed_demo_patients
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- 10 demo patients distributed across departments
INSERT INTO demo.patients (id, mrn, full_name, dob, sex, phone, district, department_id, triage_status, arrived_at) VALUES
  ('b0000000-0001-0001-0001-000000000001','SYN-DEMO-0001','Nakato Grace','1985-03-12','F','+256 701 123001','Kampala','a1b2c3d4-0001-0001-0001-000000000001','green',NOW() - INTERVAL '45 minutes'),
  ('b0000000-0001-0001-0001-000000000002','SYN-DEMO-0002','Okello Brian','1990-07-22','M','+256 702 123002','Wakiso','a1b2c3d4-0001-0001-0001-000000000001','yellow',NOW() - INTERVAL '30 minutes'),
  ('b0000000-0001-0001-0001-000000000003','SYN-DEMO-0003','Auma Stella','1975-11-05','F','+256 703 123003','Jinja','a1b2c3d4-0001-0001-0001-000000000001','green',NOW() - INTERVAL '60 minutes'),
  ('b0000000-0001-0001-0001-000000000004','SYN-DEMO-0004','Muwanga Joseph','2001-01-30','M','+256 704 123004','Kampala','a1b2c3d4-0001-0001-0001-000000000002','red',NOW() - INTERVAL '15 minutes'),
  ('b0000000-0001-0001-0001-000000000005','SYN-DEMO-0005','Namukasa Faith','1995-09-18','F','+256 705 123005','Mukono','a1b2c3d4-0001-0001-0001-000000000002','yellow',NOW() - INTERVAL '20 minutes'),
  ('b0000000-0001-0001-0001-000000000006','SYN-DEMO-0006','Ssemakula Peter','2018-04-03','M','+256 706 123006','Gulu','a1b2c3d4-0001-0001-0001-000000000003','green',NOW() - INTERVAL '90 minutes'),
  ('b0000000-0001-0001-0001-000000000007','SYN-DEMO-0007','Aceng Lydia','2019-12-25','F','+256 707 123007','Lira','a1b2c3d4-0001-0001-0001-000000000003','green',NOW() - INTERVAL '50 minutes'),
  ('b0000000-0001-0001-0001-000000000008','SYN-DEMO-0008','Tumwesige Robert','1960-06-14','M','+256 708 123008','Mbarara','a1b2c3d4-0001-0001-0001-000000000004','yellow',NOW() - INTERVAL '25 minutes'),
  ('b0000000-0001-0001-0001-000000000009','SYN-DEMO-0009','Nansubuga Rose','1955-02-28','F','+256 709 123009','Fort Portal','a1b2c3d4-0001-0001-0001-000000000004','green',NOW() - INTERVAL '70 minutes'),
  ('b0000000-0001-0001-0001-000000000010','SYN-DEMO-0010','Kagwa Emmanuel','1978-08-09','M','+256 710 123010','Soroti','a1b2c3d4-0001-0001-0001-000000000001','green',NOW() - INTERVAL '35 minutes');

-- 10 open encounters (one per patient)
INSERT INTO demo.encounters (id, patient_id, department_id, chief_complaint, status) VALUES
  ('c0000000-0001-0001-0001-000000000001','b0000000-0001-0001-0001-000000000001','a1b2c3d4-0001-0001-0001-000000000001','Persistent headache and fever for 3 days','open'),
  ('c0000000-0001-0001-0001-000000000002','b0000000-0001-0001-0001-000000000002','a1b2c3d4-0001-0001-0001-000000000001','Lower back pain and difficulty walking','open'),
  ('c0000000-0001-0001-0001-000000000003','b0000000-0001-0001-0001-000000000003','a1b2c3d4-0001-0001-0001-000000000001','Routine ANC visit — 28 weeks','open'),
  ('c0000000-0001-0001-0001-000000000004','b0000000-0001-0001-0001-000000000004','a1b2c3d4-0001-0001-0001-000000000002','Severe chest pain radiating to left arm','open'),
  ('c0000000-0001-0001-0001-000000000005','b0000000-0001-0001-0001-000000000005','a1b2c3d4-0001-0001-0001-000000000002','Shortness of breath and dizziness','open'),
  ('c0000000-0001-0001-0001-000000000006','b0000000-0001-0001-0001-000000000006','a1b2c3d4-0001-0001-0001-000000000003','Persistent cough and loss of appetite','open'),
  ('c0000000-0001-0001-0001-000000000007','b0000000-0001-0001-0001-000000000007','a1b2c3d4-0001-0001-0001-000000000003','High fever 39.5°C and convulsions','open'),
  ('c0000000-0001-0001-0001-000000000008','b0000000-0001-0001-0001-000000000008','a1b2c3d4-0001-0001-0001-000000000004','Palpitations and shortness of breath on exertion','open'),
  ('c0000000-0001-0001-0001-000000000009','b0000000-0001-0001-0001-000000000009','a1b2c3d4-0001-0001-0001-000000000004','Follow-up hypertension management','open'),
  ('c0000000-0001-0001-0001-000000000010','b0000000-0001-0001-0001-000000000010','a1b2c3d4-0001-0001-0001-000000000001','Abdominal pain and vomiting','open');

-- Vitals for 6 patients
INSERT INTO demo.vitals (patient_id, encounter_id, bp_systolic, bp_diastolic, heart_rate, temperature, spo2, weight_kg) VALUES
  ('b0000000-0001-0001-0001-000000000001','c0000000-0001-0001-0001-000000000001',128,82,88,38.2,97,62.0),
  ('b0000000-0001-0001-0001-000000000004','c0000000-0001-0001-0001-000000000004',160,105,112,37.1,94,78.5),
  ('b0000000-0001-0001-0001-000000000005','c0000000-0001-0001-0001-000000000005',95,60,118,36.8,91,54.0),
  ('b0000000-0001-0001-0001-000000000007','c0000000-0001-0001-0001-000000000007',110,70,140,39.5,98,18.5),
  ('b0000000-0001-0001-0001-000000000008','c0000000-0001-0001-0001-000000000008',148,92,95,36.9,96,82.0),
  ('b0000000-0001-0001-0001-000000000009','c0000000-0001-0001-0001-000000000009',172,108,78,36.7,97,71.0);

-- 2 pending lab orders
INSERT INTO demo.encounter_orders (encounter_id, order_type, description, status) VALUES
  ('c0000000-0001-0001-0001-000000000001','lab','Malaria RDT + FBC','pending'),
  ('c0000000-0001-0001-0001-000000000007','lab','FBC + CRP + Blood Culture','pending');
