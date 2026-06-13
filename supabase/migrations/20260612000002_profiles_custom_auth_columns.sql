ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS password_hash         TEXT,
  ADD COLUMN IF NOT EXISTS password_changed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS must_change_password  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS login_attempts        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until          TIMESTAMPTZ;
