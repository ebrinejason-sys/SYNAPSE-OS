-- Hash every facility invitation secret at rest.
--
-- Before: hospital/pharmacy provisioning stored the raw invite secret in
-- facility_invitations.invite_token (plaintext). The token_hash column and the
-- XOR constraint (exactly one of invite_token/token_hash) already exist
-- (20260910120000_facility_invitations_token_hash.sql).
--
-- This migration:
--   1. Backfills token_hash = sha256(invite_token) (hex, UTF-8 — identical to the
--      app's createHash('sha256').update(token,'utf8')) for every row that still
--      holds plaintext, and nulls the plaintext in the same UPDATE so the XOR
--      constraint holds. Live invitations keep working: the app looks up by hash.
--   2. Adds a check constraint forbidding plaintext from now on
--      (all rows satisfy it after step 1, so validation is a quick scan).
--
-- Forward-safe: no column drops, no type changes. Lock: a short ROW EXCLUSIVE
-- for the UPDATE and an ACCESS EXCLUSIVE for the ADD CONSTRAINT scan (prod has
-- 12 rows). Deploy the app that reads token_hash BEFORE applying this.
-- Rollback: `alter table public.facility_invitations drop constraint
-- facility_invitations_no_plaintext_token;` (plaintext cannot be restored, by design;
-- affected invitations can be re-sent, which issues a fresh secret).

update public.facility_invitations
   set token_hash  = encode(sha256(convert_to(invite_token, 'UTF8')), 'hex'),
       invite_token = null,
       updated_at  = now()
 where invite_token is not null
   and token_hash is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'facility_invitations_no_plaintext_token') then
    alter table public.facility_invitations
      add constraint facility_invitations_no_plaintext_token check (invite_token is null);
  end if;
end
$$;

comment on column public.facility_invitations.invite_token is
  'DEPRECATED: must be NULL. Invitation secrets are stored only as token_hash (SHA-256).';
