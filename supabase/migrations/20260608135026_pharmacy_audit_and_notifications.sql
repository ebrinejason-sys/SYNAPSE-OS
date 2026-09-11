-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260608135026  name: pharmacy_audit_and_notifications
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- ============================================================
-- AUDIT LOGS, NOTIFICATIONS, INQUIRIES
-- ============================================================

-- Audit logs (pharmacy-specific, separate from hospital audit_log)
CREATE TABLE IF NOT EXISTS pharmacy_audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES profiles(id),
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  details     TEXT,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharm_audit_tenant  ON pharmacy_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharm_audit_profile ON pharmacy_audit_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_pharm_audit_entity  ON pharmacy_audit_logs(tenant_id, entity, entity_id);

-- Pharmacy notifications (separate from global notifications table)
CREATE TABLE IF NOT EXISTS pharmacy_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL
    CHECK (type IN ('NEW_ORDER', 'ORDER_CLAIMED', 'ORDER_STATUS', 'SYSTEM', 'TRANSACTION_EDIT')),
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  related_id  TEXT,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharm_notif_profile ON pharmacy_notifications(profile_id, is_read);
CREATE INDEX IF NOT EXISTS idx_pharm_notif_tenant  ON pharmacy_notifications(tenant_id);

-- Staff inquiries (password resets, feature requests, etc.)
CREATE TABLE IF NOT EXISTS pharmacy_inquiries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id      UUID,
  user_email      TEXT NOT NULL,
  user_name       TEXT NOT NULL,
  type            TEXT NOT NULL
    CHECK (type IN ('FEATURE_REQUEST', 'PASSWORD_RESET', 'ACCESS_REQUEST', 'DELETE_REQUEST', 'OTHER')),
  subject         TEXT NOT NULL,
  message         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RESOLVED', 'REJECTED')),
  admin_response  TEXT,
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharm_inquiries_tenant ON pharmacy_inquiries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharm_inquiries_status ON pharmacy_inquiries(tenant_id, status);
