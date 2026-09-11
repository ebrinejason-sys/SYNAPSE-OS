-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612154149  name: tensor_multitenancy_capability_lattice
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- ============================================================
-- PHASE B1: Capability lattice tables
-- ============================================================

CREATE TABLE IF NOT EXISTS capabilities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module      text NOT NULL,
  resource    text NOT NULL,
  action      text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, resource, action)
);

CREATE TABLE IF NOT EXISTS role_hierarchy (
  role     text NOT NULL,
  inherits text NOT NULL,
  PRIMARY KEY (role, inherits)
);

CREATE TABLE IF NOT EXISTS facility_type_inheritance (
  facility_type text NOT NULL,
  includes      text NOT NULL,
  PRIMARY KEY (facility_type, includes)
);

CREATE TABLE IF NOT EXISTS role_capabilities (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  role          text        NOT NULL,
  facility_type text        NOT NULL DEFAULT 'any',
  capability_id uuid        NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, facility_type, capability_id)
);

CREATE INDEX IF NOT EXISTS role_capabilities_role_idx ON role_capabilities (role);
CREATE INDEX IF NOT EXISTS role_capabilities_cap_idx  ON role_capabilities (capability_id);

ALTER TABLE capabilities            ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_hierarchy          ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_type_inheritance ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_capabilities       ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated users; writes only via service role
CREATE POLICY "cap_read_authenticated" ON capabilities
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "rh_read_authenticated" ON role_hierarchy
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "fti_read_authenticated" ON facility_type_inheritance
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "rc_read_authenticated" ON role_capabilities
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- PHASE B2: Seed capability definitions
-- ============================================================

INSERT INTO capabilities (module, resource, action) VALUES
  -- Clinical
  ('clinical', 'patient',      'read'   ),
  ('clinical', 'patient',      'write'  ),
  ('clinical', 'patient',      'delete' ),
  ('clinical', 'encounter',    'read'   ),
  ('clinical', 'encounter',    'write'  ),
  ('clinical', 'encounter',    'delete' ),
  ('clinical', 'prescription', 'read'   ),
  ('clinical', 'prescription', 'write'  ),
  ('clinical', 'prescription', 'delete' ),
  ('clinical', 'prescription', 'admin'  ),
  ('clinical', 'report',       'read'   ),
  ('clinical', 'report',       'write'  ),
  -- Pharmacy
  ('pharmacy', 'inventory',    'read'   ),
  ('pharmacy', 'inventory',    'write'  ),
  ('pharmacy', 'inventory',    'admin'  ),
  ('pharmacy', 'prescription', 'read'   ),
  ('pharmacy', 'prescription', 'write'  ),
  ('pharmacy', 'supply',       'read'   ),
  ('pharmacy', 'supply',       'write'  ),
  ('pharmacy', 'report',       'read'   ),
  -- Lab
  ('lab',      'sample',       'read'   ),
  ('lab',      'sample',       'write'  ),
  ('lab',      'result',       'read'   ),
  ('lab',      'result',       'write'  ),
  ('lab',      'result',       'admin'  ),
  -- Admin
  ('admin',    'user',         'read'   ),
  ('admin',    'user',         'write'  ),
  ('admin',    'user',         'admin'  ),
  ('admin',    'tenant',       'read'   ),
  ('admin',    'tenant',       'write'  ),
  ('admin',    'report',       'read'   ),
  ('admin',    'audit',        'read'   ),
  -- Platform
  ('platform', 'tenant',       'read'   ),
  ('platform', 'tenant',       'write'  ),
  ('platform', 'tenant',       'admin'  ),
  ('platform', 'user',         'read'   ),
  ('platform', 'user',         'write'  ),
  ('platform', 'user',         'admin'  ),
  ('platform', 'audit',        'read'   )
ON CONFLICT (module, resource, action) DO NOTHING;

-- Role inheritance graph
INSERT INTO role_hierarchy (role, inherits) VALUES
  ('doctor',           'clinical_officer'),
  ('clinical_officer', 'nurse')
ON CONFLICT DO NOTHING;

-- Facility type hierarchy: hospital ⊇ clinic ⊇ pharmacy
INSERT INTO facility_type_inheritance (facility_type, includes) VALUES
  ('hospital', 'clinic'),
  ('hospital', 'pharmacy'),
  ('clinic',   'pharmacy')
ON CONFLICT DO NOTHING;

-- Role capability grants (direct only; inheritance handled by expand_roles())
INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT 'nurse', 'any', c.id FROM capabilities c
JOIN (VALUES
  ('clinical','patient',   'read' ),
  ('clinical','encounter', 'read' ),
  ('clinical','encounter', 'write')
) AS v(m,r,a) ON c.module=v.m AND c.resource=v.r AND c.action=v.a
ON CONFLICT DO NOTHING;

INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT 'clinical_officer', 'any', c.id FROM capabilities c
JOIN (VALUES
  ('clinical','patient',      'write'),
  ('clinical','prescription', 'read' ),
  ('clinical','prescription', 'write')
) AS v(m,r,a) ON c.module=v.m AND c.resource=v.r AND c.action=v.a
ON CONFLICT DO NOTHING;

INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT 'doctor', 'any', c.id FROM capabilities c
JOIN (VALUES
  ('clinical','patient',      'delete'),
  ('clinical','encounter',    'delete'),
  ('clinical','prescription', 'admin' ),
  ('clinical','prescription', 'delete'),
  ('clinical','report',       'read'  ),
  ('clinical','report',       'write' )
) AS v(m,r,a) ON c.module=v.m AND c.resource=v.r AND c.action=v.a
ON CONFLICT DO NOTHING;

INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT 'receptionist', 'any', c.id FROM capabilities c
JOIN (VALUES
  ('clinical','patient','read' ),
  ('clinical','patient','write'),
  ('admin',   'report', 'read' )
) AS v(m,r,a) ON c.module=v.m AND c.resource=v.r AND c.action=v.a
ON CONFLICT DO NOTHING;

INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT 'pharmacist', 'any', c.id FROM capabilities c
JOIN (VALUES
  ('pharmacy','inventory',    'read' ),
  ('pharmacy','inventory',    'write'),
  ('pharmacy','prescription', 'read' ),
  ('pharmacy','prescription', 'write'),
  ('pharmacy','supply',       'read' ),
  ('pharmacy','supply',       'write'),
  ('pharmacy','report',       'read' ),
  ('clinical','prescription', 'read' )
) AS v(m,r,a) ON c.module=v.m AND c.resource=v.r AND c.action=v.a
ON CONFLICT DO NOTHING;

INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT 'lab_tech', 'any', c.id FROM capabilities c
JOIN (VALUES
  ('lab','sample','read' ),
  ('lab','sample','write'),
  ('lab','result','read' ),
  ('lab','result','write'),
  ('lab','result','admin')
) AS v(m,r,a) ON c.module=v.m AND c.resource=v.r AND c.action=v.a
ON CONFLICT DO NOTHING;

-- hospital_admin: everything except platform module
INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT 'hospital_admin', 'any', id FROM capabilities WHERE module <> 'platform'
ON CONFLICT DO NOTHING;

-- platform_admin: everything
INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT 'platform_admin', 'any', id FROM capabilities
ON CONFLICT DO NOTHING;

-- ============================================================
-- PHASE B3: Resolver SQL functions
-- ============================================================

-- Returns all roles a given role inherits (including itself), recursively
CREATE OR REPLACE FUNCTION expand_roles(p_role text)
RETURNS SETOF text
LANGUAGE sql STABLE
AS $$
  WITH RECURSIVE ex(r) AS (
    SELECT p_role
    UNION
    SELECT rh.inherits
    FROM role_hierarchy rh
    JOIN ex ON ex.r = rh.role
  )
  SELECT r FROM ex;
$$;

-- Returns all facility types included by a given facility type (including itself)
CREATE OR REPLACE FUNCTION expand_facility_types(p_type text)
RETURNS SETOF text
LANGUAGE sql STABLE
AS $$
  WITH RECURSIVE ft(t) AS (
    SELECT p_type
    UNION
    SELECT fti.includes
    FROM facility_type_inheritance fti
    JOIN ft ON ft.t = fti.facility_type
  )
  SELECT t FROM ft;
$$;

-- Single resolver: true iff p_role (or any inherited role) holds the capability
-- at the given facility type (or any included type)
CREATE OR REPLACE FUNCTION has_capability(
  p_role          text,
  p_facility_type text,
  p_module        text,
  p_resource      text,
  p_action        text
) RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM role_capabilities rc
    JOIN capabilities c ON c.id = rc.capability_id
    WHERE rc.role IN (SELECT expand_roles(p_role))
      AND (
        rc.facility_type = 'any'
        OR rc.facility_type IN (SELECT expand_facility_types(p_facility_type))
      )
      AND c.module   = p_module
      AND c.resource = p_resource
      AND c.action   = p_action
  );
$$;

-- Tenant isolation check via Supabase JWT claim
-- NOTE: Requires a Supabase JWT with tenant_id claim. For custom-auth users,
-- enforcement is at the application layer via requireCapability().
CREATE OR REPLACE FUNCTION same_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(
    (auth.jwt() ->> 'tenant_id')::uuid = p_tenant_id,
    false
  );
$$;
