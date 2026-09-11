-- Public schema demo tables (matches app queries using demo_* prefix)
-- Run in Supabase SQL editor

create table if not exists public.demo_departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz default now()
);

create table if not exists public.demo_patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  mrn text unique not null,
  dob date,
  sex text check (sex in ('M', 'F')),
  triage_status text check (triage_status in ('RED', 'YELLOW', 'GREEN')) default 'GREEN',
  phone text,
  district text,
  arrived_at timestamptz default now(),
  department_id uuid references public.demo_departments(id),
  is_deleted boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.demo_encounters (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.demo_patients(id),
  chief_complaint text,
  diagnosis text,
  status text check (status in ('open', 'closed', 'pending')) default 'open',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.demo_vitals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.demo_patients(id),
  encounter_id uuid references public.demo_encounters(id),
  recorded_at timestamptz default now(),
  temperature numeric(4,1),
  heart_rate integer,
  bp_systolic integer,
  bp_diastolic integer,
  spo2 integer,
  weight_kg numeric(5,1)
);

create table if not exists public.demo_encounter_orders (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid references public.demo_encounters(id),
  order_type text check (order_type in ('lab', 'medication', 'imaging', 'procedure')),
  description text not null,
  status text check (status in ('pending', 'in_progress', 'completed', 'cancelled')) default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.ucg_guidelines (
  id uuid primary key default gen_random_uuid(),
  guideline_code text unique not null,
  title text not null,
  category text,
  subcategory text,
  content text,
  icd11_codes text[],
  is_deleted boolean default false,
  created_at timestamptz default now()
);

-- Departments
insert into public.demo_departments (name, code) values
  ('Outpatient Department', 'OPD'),
  ('Emergency', 'EMG'),
  ('Pediatrics', 'PED'),
  ('Maternity', 'MAT'),
  ('Laboratory', 'LAB')
on conflict (code) do nothing;

-- Patients
insert into public.demo_patients (full_name, mrn, dob, sex, triage_status, phone, district, arrived_at) values
  ('Ssemwanga John',    'MRN-00101', '1996-03-14', 'M', 'RED',    '+256 772 100 001', 'Kampala', now() - interval '10 minutes'),
  ('Nakato Sarah',      'MRN-00102', '1990-07-22', 'F', 'YELLOW', '+256 701 100 002', 'Wakiso',  now() - interval '25 minutes'),
  ('Okello Emmanuel',   'MRN-00103', '1978-11-05', 'M', 'RED',    '+256 782 100 003', 'Gulu',    now() - interval '5 minutes'),
  ('Atim Grace',        'MRN-00104', '2018-04-30', 'F', 'YELLOW', '+256 704 100 004', 'Lira',    now() - interval '40 minutes'),
  ('Mugisha Robert',    'MRN-00105', '1985-09-18', 'M', 'GREEN',  '+256 756 100 005', 'Mbarara', now() - interval '55 minutes'),
  ('Namukasa Fatuma',   'MRN-00106', '2005-01-12', 'F', 'GREEN',  '+256 712 100 006', 'Jinja',   now() - interval '70 minutes'),
  ('Ochen David',       'MRN-00107', '1952-06-08', 'M', 'YELLOW', '+256 774 100 007', 'Soroti',  now() - interval '80 minutes'),
  ('Nabifo Harriet',    'MRN-00108', '1999-08-25', 'F', 'GREEN',  '+256 708 100 008', 'Mbale',   now() - interval '95 minutes'),
  ('Oryem Patrick',     'MRN-00109', '2010-02-19', 'M', 'RED',    '+256 788 100 009', 'Arua',    now() - interval '3 minutes'),
  ('Akello Josephine',  'MRN-00110', '1965-12-03', 'F', 'YELLOW', '+256 715 100 010', 'Masaka',  now() - interval '110 minutes')
on conflict (mrn) do nothing;

-- Sample encounters for first patient
insert into public.demo_encounters (patient_id, chief_complaint, status, notes)
select id, 'High fever with rigors and chills', 'open',
       'Patient reports 3-day history of fever. Returned from Karamoja 1 week ago. RDT pending.'
from public.demo_patients where mrn = 'MRN-00101' limit 1;

-- Vitals for first patient
insert into public.demo_vitals (patient_id, temperature, heart_rate, bp_systolic, bp_diastolic, spo2, weight_kg)
select id, 39.2, 112, 98, 62, 96, 68.0
from public.demo_patients where mrn = 'MRN-00101' limit 1;
