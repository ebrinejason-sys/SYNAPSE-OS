-- SUPERSEDED: the actually-applied additive design uses different column
-- names (facility_invitations.token_hash / redeemed_by / department_id) and
-- adds transactional acceptance functions. See
-- supabase/migrations/20260910120000_facility_invitations_token_hash.sql and
-- supabase/migrations/20260910130000_facility_invitations_acceptance_tx.sql,
-- and docs/engineering/FACILITY_INVITATION_HARDENING.md for current status.
-- Kept only as a historical record of the earlier proposal.
--
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