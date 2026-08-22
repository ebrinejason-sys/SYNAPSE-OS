-- =============================================================================
-- Forward-only generate_synapse_id(text) hardening.
--
-- DO NOT edit 20260817120000_synapse_network_identity_foundations.sql in place:
-- that migration may already be applied live. This file is additive.
--
-- Why:
--   * postgres ascii() takes a single text argument. ascii(cc, 1) is invalid.
--   * Live SYNAPSE_OS still has zero-arg public.generate_synapse_id() used by
--     patient_profiles and granted to anon+authenticated. Do not replace or
--     revoke that overload from this repo.
--   * Person IDs must not collide with existing patient_profiles.synapse_id.
--
-- Rollback:
--   recreate generate_synapse_id(text) from 20260817120000 (not recommended).
-- =============================================================================

create or replace function public.generate_synapse_id(p_country_code text)
returns text
language plpgsql
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  raw bytea;
  n numeric;
  i int;
  body text;
  check_idx int;
  candidate text;
  cc text;
  attempts int := 0;
  taken boolean;
begin
  cc := upper(regexp_replace(coalesce(nullif(trim(p_country_code), ''), 'UG'), '[^A-Z]', '', 'g'));
  if length(cc) <> 2 then
    cc := 'UG';
  end if;

  loop
    attempts := attempts + 1;
    raw := gen_random_bytes(5);
    n := 0;
    for i in 0..4 loop
      n := n * 256 + get_byte(raw, i);
    end loop;
    body := '';
    for i in 1..8 loop
      body := substr(alphabet, (n % 32)::int + 1, 1) || body;
      n := trunc(n / 32);
    end loop;
    check_idx := (
      ascii(substr(body, 1, 1)) + ascii(substr(body, 3, 1)) + ascii(substr(body, 5, 1))
      + ascii(substr(body, 8, 1)) + ascii(substr(cc, 1, 1)) + ascii(substr(cc, 2, 1))
    ) % 32;
    candidate := 'SYN-' || cc || '-' || body || substr(alphabet, check_idx + 1, 1);
    taken := exists (select 1 from public.persons where synapse_id = candidate);
    if not taken and to_regclass('public.patient_profiles') is not null then
      execute 'select exists (select 1 from public.patient_profiles where synapse_id = $1)'
        into taken using candidate;
    end if;
    exit when not taken;
    if attempts > 8 then
      raise exception 'SYNAPSE_ID_GENERATION_FAILED';
    end if;
  end loop;
  return candidate;
end;
$$;

comment on function public.generate_synapse_id(text) is
  'Person SYNAPSE ID generator. One-arg overload; does not replace live zero-arg generate_synapse_id().';

revoke all on function public.generate_synapse_id(text) from public, anon;
grant execute on function public.generate_synapse_id(text) to authenticated, service_role;

-- Intentionally do not create, replace, or revoke generate_synapse_id().
-- Live patient_profiles depend on that overload remaining callable.
