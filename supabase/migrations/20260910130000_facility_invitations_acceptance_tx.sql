-- Transactional, identity-safe facility invitation acceptance.
--
-- This migration is additive and backward-compatible. It does not touch the
-- legacy invite_token flow. It adds:
--   1. facility_invitations.department_id — the invited department/section is
--      persisted at creation time and re-validated at acceptance instead of
--      being implied or ignored.
--   2. facility_invitation_audit — a durable audit trail for acceptance
--      success. Failure rows are written by the caller after this function
--      returns an error, because PostgreSQL rolls back every write made before
--      RAISE EXCEPTION in this transaction.
--   3. Two SECURITY DEFINER functions that perform the entire acceptance
--      operation (invitation claim + profile write + membership write +
--      audit write) as a single Postgres transaction:
--        - accept_facility_invitation_existing_user: binds an invitation to
--          an already-authenticated, already-verified session identity. It
--          never creates or updates a password.
--        - accept_facility_invitation_new_account: creates a brand-new
--          profile for an email with no existing account, sets a password
--          supplied by the caller (already hashed — this function never sees
--          a plaintext password), and never marks onboarding complete or any
--          professional-credential field.
--   Both functions lock the invitation row with SELECT ... FOR UPDATE, so
--   concurrent redemption attempts serialize on that lock: the loser sees a
--   row already in ACCEPTED status and returns INVITE_ALREADY_USED rather
--   than double-applying membership or profile writes. Any failure inside
--   the function (RAISE EXCEPTION) rolls back the entire transaction,
--   including the audit row for that attempt, which leaves the invitation in
--   its prior, retry-safe state — retry-safety comes from the database
--   transaction boundary, not from best-effort application-level cleanup.

alter table if exists public.facility_invitations
  add column if not exists department_id uuid references public.departments(id);

create table if not exists public.facility_invitation_audit (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.facility_invitations(id) on delete cascade,
  event text not null,
  actor_profile_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists facility_invitation_audit_invitation_idx
  on public.facility_invitation_audit (invitation_id, created_at);

alter table public.facility_invitation_audit enable row level security;

drop policy if exists facility_invitation_audit_platform_only on public.facility_invitation_audit;
create policy facility_invitation_audit_platform_only on public.facility_invitation_audit
  for select
  using (is_platform_admin());

-- Existing-user acceptance: the caller must already be authenticated through
-- the normal session system and the profile behind that session must be the
-- exact profile the invitation targets. Never writes password_hash.
create or replace function public.accept_facility_invitation_existing_user(
  p_token_hash text,
  p_session_profile_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_profile record;
  v_result jsonb;
begin
  if p_token_hash is null or p_session_profile_id is null then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;

  select * into v_invite
  from public.facility_invitations
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'INVITE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_invite.status = 'REVOKED' then
    raise exception 'INVITE_REVOKED' using errcode = 'P0001';
  end if;
  if v_invite.status = 'ACCEPTED' then
    raise exception 'INVITE_ALREADY_USED' using errcode = 'P0001';
  end if;
  if v_invite.expires_at < now() then
    update public.facility_invitations set status = 'EXPIRED', updated_at = now() where id = v_invite.id;
    raise exception 'INVITE_EXPIRED' using errcode = 'P0001';
  end if;
  if v_invite.status not in ('PENDING', 'SENT') then
    raise exception 'INVITE_ALREADY_USED' using errcode = 'P0001';
  end if;

  select * into v_profile from public.profiles where id = p_session_profile_id;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- The wrong authenticated recipient must never be able to redeem an
  -- invitation addressed to a different email, even with a valid token.
  if lower(v_profile.email) <> lower(v_invite.email) then
    raise exception 'WRONG_RECIPIENT' using errcode = 'P0001';
  end if;

  -- profiles.tenant_id is a legacy single "home tenant" pointer. It is never
  -- overwritten here; the invited facility is granted only by the canonical
  -- scoped assignment below.

  -- Re-validate the invited department against the facility at acceptance
  -- time — a department may have been removed or moved since the invite was
  -- issued, and an existing assignment elsewhere must never stand in as
  -- proof that this department/role was actually granted.
  if v_invite.department_id is not null and not exists (
    select 1 from public.departments where id = v_invite.department_id and tenant_id = v_invite.tenant_id
  ) then
    raise exception 'DEPARTMENT_OUT_OF_SCOPE' using errcode = 'P0001';
  end if;

  insert into public.staff_scope_assignments (profile_id, tenant_id, role, department_id, is_active)
  values (v_profile.id, v_invite.tenant_id, v_invite.role, v_invite.department_id, true)
  on conflict (profile_id, role, coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_active
  do nothing;

  update public.facility_invitations
  set status = 'ACCEPTED', accepted_at = now(), redeemed_by = v_profile.id, profile_id = v_profile.id, updated_at = now()
  where id = v_invite.id and status in ('PENDING', 'SENT');

  if not found then
    raise exception 'INVITE_ALREADY_USED' using errcode = 'P0001';
  end if;

  insert into public.facility_invitation_audit (invitation_id, event, actor_profile_id, metadata)
  values (v_invite.id, 'ACCEPTED_EXISTING_USER', v_profile.id, jsonb_build_object('tenant_id', v_invite.tenant_id, 'role', v_invite.role, 'department_id', v_invite.department_id));

  v_result := jsonb_build_object('ok', true, 'profile_id', v_profile.id, 'tenant_id', v_invite.tenant_id);
  return v_result;
end;
$$;

revoke all on function public.accept_facility_invitation_existing_user(text, uuid) from public, anon, authenticated;
grant execute on function public.accept_facility_invitation_existing_user(text, uuid) to service_role;

-- New-account acceptance: only reachable when no profile exists for the
-- invited email. Sets email ownership evidence (the caller proved control of
-- the inbox by presenting the emailed token) but never sets onboarding
-- complete and never touches a professional-credential field — those remain
-- distinct, later steps.
create or replace function public.accept_facility_invitation_new_account(
  p_token_hash text,
  p_profile_id uuid,
  p_password_hash text,
  p_full_name text,
  p_first_name text,
  p_last_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_existing record;
begin
  if p_token_hash is null or p_profile_id is null or p_password_hash is null then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;

  select * into v_invite
  from public.facility_invitations
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'INVITE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_invite.status = 'REVOKED' then
    raise exception 'INVITE_REVOKED' using errcode = 'P0001';
  end if;
  if v_invite.status = 'ACCEPTED' then
    raise exception 'INVITE_ALREADY_USED' using errcode = 'P0001';
  end if;
  if v_invite.expires_at < now() then
    update public.facility_invitations set status = 'EXPIRED', updated_at = now() where id = v_invite.id;
    raise exception 'INVITE_EXPIRED' using errcode = 'P0001';
  end if;
  if v_invite.status not in ('PENDING', 'SENT') then
    raise exception 'INVITE_ALREADY_USED' using errcode = 'P0001';
  end if;

  select * into v_existing from public.profiles where lower(email) = lower(v_invite.email);
  if found then
    -- An account now exists for this email (created out-of-band since the
    -- invite was sent). Registration must not silently overwrite it; the
    -- caller must use the existing-user acceptance path instead.
    raise exception 'IDENTITY_EXISTS' using errcode = 'P0001';
  end if;

  if v_invite.department_id is not null and not exists (
    select 1 from public.departments where id = v_invite.department_id and tenant_id = v_invite.tenant_id
  ) then
    raise exception 'DEPARTMENT_OUT_OF_SCOPE' using errcode = 'P0001';
  end if;

  insert into public.profiles (
    id, email, full_name, first_name, last_name, role, tenant_id, hospital_id,
    password_hash, must_change_password, onboarding_complete, verification_status,
    email_verified_at, created_by
  ) values (
    p_profile_id, v_invite.email, p_full_name, p_first_name, p_last_name, v_invite.role, v_invite.tenant_id, v_invite.tenant_id,
    p_password_hash, false, false, 'unverified',
    now(), v_invite.created_by
  );

  insert into public.staff_scope_assignments (profile_id, tenant_id, role, department_id, is_active)
  values (p_profile_id, v_invite.tenant_id, v_invite.role, v_invite.department_id, true)
  on conflict (profile_id, role, coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_active
  do nothing;

  update public.facility_invitations
  set status = 'ACCEPTED', accepted_at = now(), redeemed_by = p_profile_id, profile_id = p_profile_id, updated_at = now()
  where id = v_invite.id and status in ('PENDING', 'SENT');

  if not found then
    raise exception 'INVITE_ALREADY_USED' using errcode = 'P0001';
  end if;

  insert into public.facility_invitation_audit (invitation_id, event, actor_profile_id, metadata)
  values (v_invite.id, 'ACCEPTED_NEW_ACCOUNT', p_profile_id, jsonb_build_object('tenant_id', v_invite.tenant_id, 'role', v_invite.role, 'department_id', v_invite.department_id));

  return jsonb_build_object('ok', true, 'profile_id', p_profile_id, 'tenant_id', v_invite.tenant_id);
end;
$$;

revoke all on function public.accept_facility_invitation_new_account(text, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.accept_facility_invitation_new_account(text, uuid, text, text, text, text) to service_role;

comment on function public.accept_facility_invitation_existing_user(text, uuid) is
  'Transactional invitation acceptance for an already-authenticated existing profile. Never writes password_hash. Rolls back entirely on any failure.';
comment on function public.accept_facility_invitation_new_account(text, uuid, text, text, text, text) is
  'Transactional invitation acceptance that creates a brand-new profile. Never sets onboarding_complete=true and never sets a professional-credential field. Rolls back entirely on any failure.';
