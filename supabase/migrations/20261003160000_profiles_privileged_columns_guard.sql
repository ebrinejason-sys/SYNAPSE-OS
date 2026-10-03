-- Privilege-escalation fix: API roles (anon/authenticated) could UPDATE their
-- own profiles row, including role, tenant_id, hospital_id, is_admin,
-- platform_control_role, password_hash and email, which RLS helpers trust.
--
-- 1. Table/column privileges: API roles lose INSERT/UPDATE (and the unused
--    TRUNCATE/TRIGGER/REFERENCES). authenticated keeps UPDATE only on
--    self-service contact columns. All privileged writes go through
--    server routes using service_role.
-- 2. Guard trigger (defence in depth, survives a future broad re-grant):
--    for anon/authenticated, any change outside the self-service allow-list
--    raises 42501. New columns are privileged by default.
-- 3. Signup triggers no longer trust is_admin / role / department_id from
--    user-controlled raw_user_meta_data.
--
-- service_role, postgres and SECURITY DEFINER functions are unaffected.

-- 1. Privileges ---------------------------------------------------------------
revoke insert, update, truncate, trigger, references on table public.profiles from anon, authenticated;

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into cols
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'profiles'
    and c.column_name = any (array[
      'full_name', 'first_name', 'last_name', 'phone', 'avatar_url', 'gender',
      'date_of_birth', 'blood_type', 'emergency_contact_name',
      'emergency_contact_phone', 'updated_at'
    ]);
  if cols is not null then
    execute format('grant update (%s) on table public.profiles to authenticated', cols);
  end if;
end $$;

-- 2. Guard trigger ------------------------------------------------------------
create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  self_service constant text[] := array[
    'full_name', 'first_name', 'last_name', 'phone', 'avatar_url', 'gender',
    'date_of_birth', 'blood_type', 'emergency_contact_name',
    'emergency_contact_phone', 'updated_at'
  ];
begin
  -- Only API roles are restricted. SECURITY DEFINER callers run as their owner.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'profiles rows are created server-side only'
      using errcode = '42501';
  end if;

  if (to_jsonb(new) - self_service) is distinct from (to_jsonb(old) - self_service) then
    raise exception 'privileged profiles columns cannot be changed by this role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.profiles_guard_privileged_columns() from public;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_privileged_columns();

-- 3. Signup triggers ----------------------------------------------------------
-- Profiles created by self-service signup never receive admin rights from
-- metadata; facility staff and admins are provisioned server-side.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, is_admin)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    false
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        email     = excluded.email;
  return new;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Role and department are assigned by server-side provisioning only.
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    'patient'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.handle_new_user_profile() to service_role;

-- 4. Payroll compensation (service-role only; replaces the non-existent
--    profiles.base_salary_ugx the admin payroll page wrote from the browser).
create table if not exists public.staff_compensation (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  tenant_id uuid not null,
  base_salary_ugx numeric(14, 2) not null check (base_salary_ugx >= 0),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create index if not exists staff_compensation_tenant_idx on public.staff_compensation (tenant_id);
alter table public.staff_compensation enable row level security;
revoke all on table public.staff_compensation from public, anon, authenticated;
grant select, insert, update, delete on table public.staff_compensation to service_role;
