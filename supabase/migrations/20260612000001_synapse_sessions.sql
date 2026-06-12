CREATE TABLE IF NOT EXISTS synapse_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  app          TEXT NOT NULL CHECK (app IN ('web', 'pharmacy', 'mobile', 'api')),
  ip_address   TEXT,
  user_agent   TEXT,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_synapse_sessions_user
  ON synapse_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_synapse_sessions_hash
  ON synapse_sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_synapse_sessions_user_app
  ON synapse_sessions(user_id, app);

ALTER TABLE synapse_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_sessions_select" ON synapse_sessions
  FOR SELECT USING (user_id = auth.uid());
