-- Additive, backward-compatible schema support for hashed, single-use facility
-- staff invitations (canonical identity/membership model). Existing rows and
-- the legacy self-service hospital-admin invite/redeem flow are untouched:
-- they continue to use invite_token as a raw token. New, hardened invitations
-- created by the platform-admin flow store only a token_hash and leave
-- invite_token NULL — the raw token is never persisted server-side.

alter table if exists public.facility_invitations
  alter column invite_token drop not null;

alter table if exists public.facility_invitations
  add column if not exists token_hash text;

alter table if exists public.facility_invitations
  add column if not exists redeemed_by uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'facility_invitations_token_xor_hash'
  ) then
    alter table public.facility_invitations
      add constraint facility_invitations_token_xor_hash
      check (num_nonnulls(invite_token, token_hash) = 1);
  end if;
end
$$;

create unique index if not exists facility_invitations_token_hash_uidx
  on public.facility_invitations (token_hash)
  where token_hash is not null;

comment on column public.facility_invitations.token_hash is
  'SHA-256 hash of the single-use invitation secret for hardened, platform-admin-issued invitations. The raw secret is never stored.';
comment on column public.facility_invitations.redeemed_by is
  'Profile that redeemed this invitation, for durable audit.';
