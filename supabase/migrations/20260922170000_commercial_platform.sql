-- Commercial platform: annual pricing catalog, price history, CRM pipeline,
-- meetings, and subscription commercial snapshots.
-- Additive. Does not rewrite historical subscription payment amounts.
-- Does NOT apply to production until migration ledger is reconciled.

-- ── Pricing states ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commercial_pricing_state') THEN
    CREATE TYPE public.commercial_pricing_state AS ENUM (
      'PUBLIC_FIXED',
      'STARTING_AT',
      'CUSTOM_QUOTE',
      'INCLUDED',
      'ADD_ON',
      'COMING_SOON',
      'HIDDEN'
    );
  END IF;
END $$;

-- ── Extend subscription_plans for commercial catalog metadata ────────────────
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS pricing_state text NOT NULL DEFAULT 'PUBLIC_FIXED',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'annual',
  ADD COLUMN IF NOT EXISTS standalone_available boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS addon_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_plan_slugs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS public_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS feature_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS highlighted_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cta_label text,
  ADD COLUMN IF NOT EXISTS cta_href text,
  ADD COLUMN IF NOT EXISTS custom_quote boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS effective_from timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS previous_price_ugx numeric,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscription_plans_pricing_state_check'
      AND conrelid = 'public.subscription_plans'::regclass
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD CONSTRAINT subscription_plans_pricing_state_check
      CHECK (pricing_state IN (
        'PUBLIC_FIXED','STARTING_AT','CUSTOM_QUOTE','INCLUDED',
        'ADD_ON','COMING_SOON','HIDDEN'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS subscription_plans_public_visible_idx
  ON public.subscription_plans (public_visible, display_order)
  WHERE is_active = true;

-- ── Price history (append-only commercial audit) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.commercial_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  plan_slug text NOT NULL,
  previous_price_ugx numeric,
  new_price_ugx numeric,
  previous_pricing_state text,
  new_pricing_state text,
  previous_feature_list jsonb,
  new_feature_list jsonb,
  change_reason text,
  effective_from timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_price_history_plan_idx
  ON public.commercial_price_history (plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commercial_price_history_slug_idx
  ON public.commercial_price_history (plan_slug, created_at DESC);

ALTER TABLE public.commercial_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_price_history_platform_read ON public.commercial_price_history;
CREATE POLICY commercial_price_history_platform_read ON public.commercial_price_history
  FOR SELECT USING (is_platform_admin());

DROP POLICY IF EXISTS commercial_price_history_platform_insert ON public.commercial_price_history;
CREATE POLICY commercial_price_history_platform_insert ON public.commercial_price_history
  FOR INSERT WITH CHECK (is_platform_admin());

-- Block updates/deletes on price history (append-only via RLS deny)
DROP POLICY IF EXISTS commercial_price_history_no_update ON public.commercial_price_history;
CREATE POLICY commercial_price_history_no_update ON public.commercial_price_history
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS commercial_price_history_no_delete ON public.commercial_price_history;
CREATE POLICY commercial_price_history_no_delete ON public.commercial_price_history
  FOR DELETE USING (false);

-- Public can read active public plans (anon + authenticated) for website pricing
DROP POLICY IF EXISTS subscription_plans_public_read ON public.subscription_plans;
CREATE POLICY subscription_plans_public_read ON public.subscription_plans
  FOR SELECT
  USING (
    is_active = true
    AND public_visible = true
    AND pricing_state <> 'HIDDEN'
  );

DROP POLICY IF EXISTS subscription_plans_platform_manage ON public.subscription_plans;
CREATE POLICY subscription_plans_platform_manage ON public.subscription_plans
  FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── Snapshot commercial terms on tenant subscriptions ────────────────────────
ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS agreed_price_ugx numeric,
  ADD COLUMN IF NOT EXISTS agreed_currency text NOT NULL DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS agreed_billing_period text NOT NULL DEFAULT 'annual',
  ADD COLUMN IF NOT EXISTS addon_slugs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS addon_total_ugx numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_ugx numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_negotiated_ugx numeric,
  ADD COLUMN IF NOT EXISTS billing_contact_email text,
  ADD COLUMN IF NOT EXISTS billing_contact_name text,
  ADD COLUMN IF NOT EXISTS contract_reference text,
  ADD COLUMN IF NOT EXISTS commercial_notes text,
  ADD COLUMN IF NOT EXISTS renewal_date timestamptz,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';

DO $$
BEGIN
  -- Expand subscription status machine for grace/expired without breaking existing
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenant_subscriptions_status_check'
      AND conrelid = 'public.tenant_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.tenant_subscriptions
      DROP CONSTRAINT tenant_subscriptions_status_check;
  END IF;
  ALTER TABLE public.tenant_subscriptions
    ADD CONSTRAINT tenant_subscriptions_status_check
    CHECK (status IN (
      'trialing','trial','active','past_due','grace_period',
      'suspended','cancelled','canceled','expired'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── CRM: extend hospital_leads into full commercial pipeline ─────────────────
ALTER TABLE public.hospital_leads
  ADD COLUMN IF NOT EXISTS organization_name text,
  ADD COLUMN IF NOT EXISTS facility_name text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'UG',
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS estimated_size text,
  ADD COLUMN IF NOT EXISTS locations_count integer,
  ADD COLUMN IF NOT EXISTS requested_products text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS expected_value_ugx numeric,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS meeting_preferred_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_state text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS converted_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_kind text NOT NULL DEFAULT 'facility',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill facility_name / organization_name from hospital_name
UPDATE public.hospital_leads
SET
  facility_name = COALESCE(facility_name, hospital_name),
  organization_name = COALESCE(organization_name, hospital_name)
WHERE facility_name IS NULL OR organization_name IS NULL;

-- Expand stage check to commercial lifecycle
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hospital_leads_stage_check'
      AND conrelid = 'public.hospital_leads'::regclass
  ) THEN
    ALTER TABLE public.hospital_leads DROP CONSTRAINT hospital_leads_stage_check;
  END IF;
  ALTER TABLE public.hospital_leads
    ADD CONSTRAINT hospital_leads_stage_check
    CHECK (stage IN (
      'LEAD','CONTACTED','QUALIFIED','DEMO_BOOKED','PROPOSAL',
      'NEGOTIATION','WON','ONBOARDING','ACTIVE','LOST',
      -- legacy stages retained for existing rows
      'interest','demo','trial','converted','lost'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Map legacy stages to new pipeline (non-destructive alias; keep legacy values)
-- New inserts should use uppercase stages.

CREATE INDEX IF NOT EXISTS hospital_leads_stage_idx ON public.hospital_leads (stage);
CREATE INDEX IF NOT EXISTS hospital_leads_assigned_idx ON public.hospital_leads (assigned_to);
CREATE INDEX IF NOT EXISTS hospital_leads_next_action_idx ON public.hospital_leads (next_action_at);

-- Platform-only SELECT/UPDATE/DELETE; public INSERT for meeting/contact forms
DROP POLICY IF EXISTS platform_admin_only ON public.hospital_leads;
DROP POLICY IF EXISTS hospital_leads_platform_all ON public.hospital_leads;
CREATE POLICY hospital_leads_platform_all ON public.hospital_leads
  FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS hospital_leads_public_insert ON public.hospital_leads;
CREATE POLICY hospital_leads_public_insert ON public.hospital_leads
  FOR INSERT
  WITH CHECK (
    stage IN ('LEAD', 'interest')
    AND COALESCE(status, 'new') IN ('new', 'meeting_requested')
  );

-- ── Meetings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commercial_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.hospital_leads(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN (
      'requested','scheduled','confirmed','completed','cancelled','no_show'
    )),
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  requester_phone text,
  organization_name text,
  facility_name text,
  facility_type text,
  country text,
  approximate_size text,
  locations_count integer,
  products_interested text[] NOT NULL DEFAULT '{}',
  current_software text,
  preferred_at timestamptz,
  scheduled_at timestamptz,
  timezone text DEFAULT 'Africa/Kampala',
  message text,
  scheduling_provider text,
  external_event_id text,
  assigned_to uuid,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_meetings_status_idx
  ON public.commercial_meetings (status, preferred_at);
CREATE INDEX IF NOT EXISTS commercial_meetings_lead_idx
  ON public.commercial_meetings (lead_id);
CREATE INDEX IF NOT EXISTS commercial_meetings_email_idx
  ON public.commercial_meetings (requester_email);

ALTER TABLE public.commercial_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_meetings_platform_all ON public.commercial_meetings;
CREATE POLICY commercial_meetings_platform_all ON public.commercial_meetings
  FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS commercial_meetings_public_insert ON public.commercial_meetings;
CREATE POLICY commercial_meetings_public_insert ON public.commercial_meetings
  FOR INSERT
  WITH CHECK (status = 'requested');

-- ── Lead activity history ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commercial_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.hospital_leads(id) ON DELETE CASCADE,
  meeting_id uuid REFERENCES public.commercial_meetings(id) ON DELETE SET NULL,
  activity_type text NOT NULL,
  summary text NOT NULL,
  body text,
  from_stage text,
  to_stage text,
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_lead_activities_lead_idx
  ON public.commercial_lead_activities (lead_id, created_at DESC);

ALTER TABLE public.commercial_lead_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_lead_activities_platform ON public.commercial_lead_activities;
CREATE POLICY commercial_lead_activities_platform ON public.commercial_lead_activities
  FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── Seed / upsert annual commercial plans ────────────────────────────────────
-- Suspend prior pharmacy monthly/quarterly public display (keep rows for FKs).
UPDATE public.subscription_plans
SET
  public_visible = false,
  pricing_state = 'HIDDEN',
  updated_at = now()
WHERE slug IN (
  'pharmacy_starter', 'pharmacy_growth', 'pharmacy_multi_branch',
  'pharm_monthly', 'pharm_quarterly', 'starter_pharmacy', 'growth_pharmacy'
);

WITH fx AS (
  SELECT COALESCE((value->>'ugx_per_usd')::numeric, 3700) AS ugx_per_usd
  FROM public.platform_billing_config
  WHERE key = 'fx'
  LIMIT 1
),
canonical AS (
  SELECT * FROM (VALUES
    (
      'synapse_pharmacy_annual',
      'SYNAPSE Pharmacy',
      'pharmacy',
      240000::numeric,
      'PUBLIC_FIXED',
      'Standalone pharmacy management for independent and community pharmacies.',
      true, false, '{}'::text[],
      10,
      '["Inventory management","Purchasing & goods receipt","Supplier management","Dispensing","POS / billing","Stock, batch & expiry tracking","Reports","Users & roles","Mobile / Expo access where supported"]'::jsonb,
      '["Inventory","Purchasing","POS"]'::jsonb,
      'Get Started', '/book-meeting?product=pharmacy', false
    ),
    (
      'synapse_lab_annual',
      'SYNAPSE Lab',
      'laboratory',
      1000000::numeric,
      'PUBLIC_FIXED',
      'Standalone laboratory and diagnostic facility operations.',
      true, false, '{}'::text[],
      20,
      '["Laboratory workflow","Orders","Specimen management","Results","Verification & release","Analyzer / device connectivity where supported","Lab Edge","AI-assisted interpretation where supported","Reporting","Users & roles"]'::jsonb,
      '["Workflow","Devices","Results"]'::jsonb,
      'Get Started', '/book-meeting?product=lab', false
    ),
    (
      'synapse_os_basic_annual',
      'SYNAPSE OS Basic',
      'hospital',
      1500000::numeric,
      'STARTING_AT',
      'Core clinical and facility platform for hospitals and clinics.',
      true, false, '{}'::text[],
      30,
      '["Patient registration","Synapse ID","Reception","Triage","Encounters","Clinical documentation","Diagnoses","Orders","Billing","Referrals","Consent","Clinical documents","Pathways","Basic reporting","Role & capability management"]'::jsonb,
      '["Encounters","Billing","Referrals"]'::jsonb,
      'Get Started', '/book-meeting?product=os', false
    ),
    (
      'synapse_os_lab_addon_annual',
      'Lab add-on for SYNAPSE OS',
      'hospital',
      500000::numeric,
      'ADD_ON',
      'Add laboratory module to an existing SYNAPSE OS facility. Distinct from standalone Lab pricing.',
      false, true, ARRAY['synapse_os_basic_annual'],
      40,
      '["Laboratory workflow integrated with SYNAPSE OS","Orders from clinical encounters","Specimen lifecycle","Results & verification","Device connectivity where supported"]'::jsonb,
      '["OS-integrated Lab"]'::jsonb,
      'Add Lab', '/book-meeting?product=os-lab-addon', false
    ),
    (
      'synapse_enterprise',
      'SYNAPSE Enterprise',
      'hospital',
      NULL::numeric,
      'CUSTOM_QUOTE',
      'Custom pricing for large hospitals, groups, multisite organizations, and complex deployments.',
      true, false, '{}'::text[],
      50,
      '["Multisite organizations","Custom modules & integrations","Data migration support","Implementation & training","Infrastructure options","Support agreements by arrangement"]'::jsonb,
      '["Custom quote","Book a Meeting"]'::jsonb,
      'Book a Meeting', '/book-meeting?product=enterprise', true
    ),
    (
      'synapse_intelligence',
      'SYNAPSE Intelligence',
      'hospital',
      NULL::numeric,
      'CUSTOM_QUOTE',
      'Clinician-controlled AI assistance across the SYNAPSE ecosystem.',
      true, false, '{}'::text[],
      60,
      '["AI-assisted differentials where enabled","Pathway suggestions","Clinician remains responsible for decisions"]'::jsonb,
      '["Clinician-controlled AI"]'::jsonb,
      'Contact us', '/book-meeting?product=intelligence', true
    ),
    (
      'synapse_exchange',
      'SYNAPSE Exchange',
      'hospital',
      NULL::numeric,
      'COMING_SOON',
      'Interoperability and health information exchange capabilities.',
      true, false, '{}'::text[],
      70,
      '["FHIR-oriented APIs","Referral exchange direction","Integration with existing health systems"]'::jsonb,
      '[]'::jsonb,
      'Contact us', '/book-meeting?product=exchange', true
    )
  ) AS v(
    slug, name, facility_type, price_ugx, pricing_state, description,
    standalone_available, addon_available, parent_plan_slugs,
    display_order, feature_list, highlighted_features,
    cta_label, cta_href, custom_quote
  )
)
INSERT INTO public.subscription_plans (
  slug, name, facility_type, price_usd, price_ugx, billing_cycle, is_active,
  pricing_state, description, currency, billing_period,
  standalone_available, addon_available, parent_plan_slugs,
  public_visible, display_order, feature_list, highlighted_features,
  cta_label, cta_href, custom_quote, effective_from, version, updated_at
)
SELECT
  c.slug,
  c.name,
  c.facility_type,
  CASE WHEN c.price_ugx IS NULL THEN NULL ELSE ROUND(c.price_ugx / COALESCE(fx.ugx_per_usd, 3700), 2) END,
  c.price_ugx,
  'yearly',
  true,
  c.pricing_state,
  c.description,
  'UGX',
  'annual',
  c.standalone_available,
  c.addon_available,
  c.parent_plan_slugs,
  true,
  c.display_order,
  c.feature_list,
  c.highlighted_features,
  c.cta_label,
  c.cta_href,
  c.custom_quote,
  now(),
  1,
  now()
FROM canonical c
LEFT JOIN fx ON true
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  facility_type = EXCLUDED.facility_type,
  price_usd = EXCLUDED.price_usd,
  price_ugx = EXCLUDED.price_ugx,
  billing_cycle = 'yearly',
  is_active = true,
  pricing_state = EXCLUDED.pricing_state,
  description = EXCLUDED.description,
  currency = 'UGX',
  billing_period = 'annual',
  standalone_available = EXCLUDED.standalone_available,
  addon_available = EXCLUDED.addon_available,
  parent_plan_slugs = EXCLUDED.parent_plan_slugs,
  public_visible = true,
  display_order = EXCLUDED.display_order,
  feature_list = EXCLUDED.feature_list,
  highlighted_features = EXCLUDED.highlighted_features,
  cta_label = EXCLUDED.cta_label,
  cta_href = EXCLUDED.cta_href,
  custom_quote = EXCLUDED.custom_quote,
  updated_at = now();

-- Keep pharm_yearly aligned with new pharmacy annual public price if present
UPDATE public.subscription_plans
SET
  price_ugx = 240000,
  price_usd = ROUND(240000 / 3700.0, 2),
  billing_cycle = 'yearly',
  pricing_state = 'PUBLIC_FIXED',
  public_visible = false,
  billing_period = 'annual',
  updated_at = now()
WHERE slug = 'pharm_yearly';

-- Seed features on annual pharmacy plan
INSERT INTO public.plan_features (plan_id, feature_key, value)
SELECT p.id, f.feature_key, 'true'::jsonb
FROM public.subscription_plans p
CROSS JOIN (VALUES
  ('pos.sell'),
  ('inventory.read'),
  ('inventory.write'),
  ('receipts.print'),
  ('billing.view'),
  ('account.view'),
  ('data.read'),
  ('data.export'),
  ('reports.generate'),
  ('purchasing.manage')
) AS f(feature_key)
WHERE p.slug = 'synapse_pharmacy_annual'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

COMMENT ON TABLE public.commercial_price_history IS
  'Append-only audit of commercial catalog price and feature changes.';
COMMENT ON TABLE public.commercial_meetings IS
  'Public Book-a-Meeting requests and platform-managed meeting lifecycle.';
COMMENT ON TABLE public.commercial_lead_activities IS
  'Platform-only CRM activity history for commercial leads.';
