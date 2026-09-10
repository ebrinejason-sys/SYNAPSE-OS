-- Reviewable proposal only. Do not apply until the remote migration ledger is reconciled.
ALTER TABLE public.facility_invitations
  ADD COLUMN IF NOT EXISTS invite_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS accepted_by UUID,
  ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.facility_invitations
  ALTER COLUMN invite_token DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_facility_invitations_token_hash
  ON public.facility_invitations (invite_token_hash)
  WHERE invite_token_hash IS NOT NULL;

COMMENT ON COLUMN public.facility_invitations.invite_token_hash IS
  'SHA-256 token digest; raw invite tokens must not be persisted for new invitations.';
COMMENT ON COLUMN public.facility_invitations.accepted_by IS
  'Authenticated profile that accepted the invitation; distinct from the invited profile created at acceptance.';