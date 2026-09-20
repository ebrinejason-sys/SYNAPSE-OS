-- New-account invitation redemption must persist a canonical profiles row.
-- The 20260910 function wrote:
--   verification_status = 'unverified'  (not in profiles_verification_status_check)
--   hospital_id = tenant_id             (hospitals FK, not tenants)
--   created_by = invitation.created_by  (auth.users FK; invitation actor is a profile id)
-- Those values made redemption fail after a valid invitation was created.

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
    p_profile_id, v_invite.email, p_full_name, p_first_name, p_last_name, v_invite.role, v_invite.tenant_id, null,
    p_password_hash, false, false, 'pending',
    now(), null
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

comment on function public.accept_facility_invitation_new_account(text, uuid, text, text, text, text) is
  'Transactional invitation acceptance that creates a brand-new profile with canonical role/verification columns. Never sets onboarding_complete=true and never writes auth.users created_by.';
