-- Lab Edge credentials: hashed-only modern rows. Prefix is display metadata, never an authenticator.
-- Do not rewrite historical applied migrations.

ALTER TABLE public.lab_instrument_bridges
  ALTER COLUMN api_key DROP NOT NULL;

-- Modern hashed rows created by the prior PR stored a deterministic ref: placeholder in api_key.
-- Clear api_key only where a digest already exists so legacy plaintext credentials remain intact.
UPDATE public.lab_instrument_bridges
SET api_key = NULL
WHERE api_key_hash IS NOT NULL;

ALTER TABLE public.lab_instrument_bridges
  DROP CONSTRAINT IF EXISTS lab_instrument_bridges_credential_xor;

ALTER TABLE public.lab_instrument_bridges
  ADD CONSTRAINT lab_instrument_bridges_credential_xor
  CHECK ((api_key IS NULL) <> (api_key_hash IS NULL));

DROP INDEX IF EXISTS idx_lab_instrument_bridges_hash;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_instrument_bridges_hash_unique
  ON public.lab_instrument_bridges (api_key_hash)
  WHERE api_key_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lab_instrument_bridges_prefix
  ON public.lab_instrument_bridges (api_key_prefix)
  WHERE api_key_prefix IS NOT NULL;

COMMENT ON COLUMN public.lab_instrument_bridges.api_key IS
  'Legacy plaintext Lab Edge secret. NULL for modern hashed credentials. Never store ref: placeholders here.';
COMMENT ON COLUMN public.lab_instrument_bridges.api_key_hash IS
  'HMAC-SHA-256 of the issued Lab Edge bearer token keyed by LAB_BRIDGE_HASH_SECRET. Prefix is not sufficient to authenticate.';
COMMENT ON COLUMN public.lab_instrument_bridges.api_key_prefix IS
  'Operator display identifier only. Must never be used as a credential.';
