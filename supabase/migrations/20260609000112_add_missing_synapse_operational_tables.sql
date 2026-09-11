-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260609000112  name: add_missing_synapse_operational_tables
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Missing Synapse Health operational tables and surgery schedule extensions
-- Idempotent migration for SynapseOS / Synapse Pharm, June 2026

CREATE TABLE IF NOT EXISTS public.mfa_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  backup_codes TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
ALTER TABLE public.mfa_enrollments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_mfa_enrollments_user_id ON public.mfa_enrollments(user_id);

CREATE TABLE IF NOT EXISTS public.pharmacy_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.pharmacy_customers(id),
  transaction_id UUID REFERENCES public.pharmacy_transactions(id),
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'repayment')),
  balance_after NUMERIC NOT NULL,
  due_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.pharmacy_credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pharmacy_credit_ledger_tenant ON public.pharmacy_credit_ledger(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_credit_ledger_customer ON public.pharmacy_credit_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_credit_ledger_due_date ON public.pharmacy_credit_ledger(due_date);

CREATE TABLE IF NOT EXISTS public.refill_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.pharmacy_customers(id),
  drug_name TEXT NOT NULL,
  last_dispensed DATE,
  refill_due_date DATE NOT NULL,
  interval_days INTEGER DEFAULT 30,
  reminder_sent BOOLEAN DEFAULT false,
  last_reminder_sent_at TIMESTAMPTZ,
  dispensed BOOLEAN DEFAULT false,
  dispensed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.refill_reminders ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_refill_reminders_tenant ON public.refill_reminders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_refill_reminders_due_date ON public.refill_reminders(refill_due_date);
CREATE INDEX IF NOT EXISTS idx_refill_reminders_customer ON public.refill_reminders(customer_id);

CREATE TABLE IF NOT EXISTS public.pharmacy_staff_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL,
  can_view_inventory BOOLEAN DEFAULT true,
  can_edit_inventory BOOLEAN DEFAULT false,
  can_process_sales BOOLEAN DEFAULT true,
  can_apply_discounts BOOLEAN DEFAULT false,
  can_access_credit_records BOOLEAN DEFAULT false,
  can_approve_stock_adjustments BOOLEAN DEFAULT false,
  can_access_financial_reports BOOLEAN DEFAULT false,
  can_manage_staff BOOLEAN DEFAULT false,
  can_access_settings BOOLEAN DEFAULT false,
  max_discount_percent NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.pharmacy_staff_permissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pharmacy_staff_permissions_tenant ON public.pharmacy_staff_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_staff_permissions_staff ON public.pharmacy_staff_permissions(staff_id);

CREATE TABLE IF NOT EXISTS public.body_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  body_ref TEXT,
  body_name TEXT,
  admission_date TIMESTAMPTZ DEFAULT now(),
  referred_from TEXT,
  condition_on_arrival TEXT,
  storage_bay TEXT,
  cause_of_death TEXT,
  is_forensic BOOLEAN DEFAULT false,
  post_mortem_done BOOLEAN DEFAULT false,
  post_mortem_notes TEXT,
  released BOOLEAN DEFAULT false,
  released_to TEXT,
  released_relationship TEXT,
  released_date DATE,
  id_document_verified BOOLEAN DEFAULT false,
  police_notified BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.body_register ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_body_register_tenant ON public.body_register(tenant_id);

CREATE TABLE IF NOT EXISTS public.visitor_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visitor_name TEXT NOT NULL,
  national_id TEXT,
  host_staff_id UUID,
  host_name TEXT,
  purpose TEXT,
  vehicle_reg TEXT,
  time_in TIMESTAMPTZ DEFAULT now(),
  time_out TIMESTAMPTZ,
  badge_number TEXT,
  logged_by UUID,
  notes TEXT
);
ALTER TABLE public.visitor_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_visitor_log_tenant ON public.visitor_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visitor_log_time_in ON public.visitor_log(time_in);

CREATE TABLE IF NOT EXISTS public.housekeeping_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  task_type TEXT,
  task_description TEXT,
  assigned_to UUID,
  scheduled_time TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  verified_by UUID,
  verification_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.housekeeping_tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_tenant ON public.housekeeping_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_scheduled_time ON public.housekeeping_tasks(scheduled_time);

CREATE TABLE IF NOT EXISTS public.partograph_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL,
  admission_time TIMESTAMPTZ,
  entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  delivery_time TIMESTAMPTZ,
  delivery_type TEXT,
  birth_weight_grams NUMERIC,
  apgar_1min INTEGER,
  apgar_5min INTEGER,
  complications TEXT,
  midwife_id UUID,
  doctor_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.partograph_records ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_partograph_records_tenant ON public.partograph_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_partograph_records_patient ON public.partograph_records(patient_id);

ALTER TABLE public.surgery_schedules
  ADD COLUMN IF NOT EXISTS pre_op_checklist JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS instrument_count_pre JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS instrument_count_post JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS implants_used TEXT,
  ADD COLUMN IF NOT EXISTS intraop_complications TEXT,
  ADD COLUMN IF NOT EXISTS actual_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_end TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.pharmacy_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  receipt_url TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.pharmacy_expenses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pharmacy_expenses_tenant ON public.pharmacy_expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_expenses_date ON public.pharmacy_expenses(expense_date);

CREATE TABLE IF NOT EXISTS public.pharmacy_import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_system TEXT,
  file_name TEXT,
  file_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'mapping', 'review', 'importing', 'complete', 'failed')),
  total_rows INTEGER DEFAULT 0,
  matched_rows INTEGER DEFAULT 0,
  flagged_rows INTEGER DEFAULT 0,
  duplicate_rows INTEGER DEFAULT 0,
  ai_mapping JSONB DEFAULT '{}'::jsonb,
  ai_summary TEXT,
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.pharmacy_import_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pharmacy_import_sessions_tenant ON public.pharmacy_import_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_import_sessions_status ON public.pharmacy_import_sessions(status);
