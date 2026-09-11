#!/usr/bin/env bash
# Real, isolated Postgres-backed acceptance tests for the facility-invitation
# transactional RPCs. Runs against a disposable container created by the
# caller (see docs/engineering/FACILITY_INVITATION_HARDENING.md for the exact
# `docker run` invocation used in CI/local verification). Never touches
# production. This script proves behavior that mock-only unit tests cannot:
# real transactions, real unique constraints, real concurrency, and real RLS.
#
# Usage: PGHOST=localhost PGPORT=55432 PGUSER=postgres PGPASSWORD=postgres \
#        PGDATABASE=postgres ./scripts/db-tests/run-facility-invitation-db-tests.sh
set -euo pipefail

if [[ "${SYNAPSE_DISPOSABLE_DB_TEST:-}" != true || "${PGHOST:-}" != 127.0.0.1 ]]; then
  echo 'Use scripts/db-tests/run-isolated.sh; this suite writes synthetic fixtures.' >&2
  exit 1
fi
test_tmp=$(mktemp -d)
trap 'rm -rf "$test_tmp"' EXIT

PSQL="psql -X -q -v ON_ERROR_STOP=1"
PASS=0
FAIL=0
FAILED_NAMES=()

pass() { PASS=$((PASS + 1)); echo "PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); FAILED_NAMES+=("$1"); echo "FAIL: $1 -- $2"; }

scalar() {
  # Runs a single-value query as the given role/claim and prints the result.
  # $1=role $2=sub-claim (may be empty) $3=sql
  local role="$1" sub="$2" sql="$3"
  local preamble="set role ${role};"
  if [ -n "$sub" ]; then preamble="${preamble} set request.jwt.claim.sub = '${sub}';"; fi
  $PSQL -tA -c "${preamble} ${sql}"
}

# Runs SQL expected to raise; prints the error message (SQLSTATE text) or
# "NO_ERROR" if it unexpectedly succeeded.
expect_error() {
  local role="$1" sub="$2" sql="$3"
  local preamble="set role ${role};"
  if [ -n "$sub" ]; then preamble="${preamble} set request.jwt.claim.sub = '${sub}';"; fi
  local out
  if out=$($PSQL -tA -c "${preamble} ${sql}" 2>&1); then
    echo "NO_ERROR: ${out}"
  else
    echo "${out}" | grep -oE 'ERROR:.*' | head -1
  fi
}

echo "=== Facility invitation acceptance: isolated Postgres tests ==="
echo "Target: ${PGHOST:-localhost}:${PGPORT:-5432}/${PGDATABASE:-postgres} as ${PGUSER:-postgres}"

# ---------------------------------------------------------------------------
# Fixtures (as postgres, which bypasses RLS like service_role does)
# ---------------------------------------------------------------------------
$PSQL <<'SQL'
begin;

insert into tenants (id, slug, name, facility_type, is_synthetic, environment, data_classification)
values
  ('11111111-1111-1111-1111-111111111111', 'lab-a', 'DB Test Lab A', 'laboratory', true, 'test', 'synthetic'),
  ('22222222-2222-2222-2222-222222222222', 'lab-b', 'DB Test Lab B', 'laboratory', true, 'test', 'synthetic'),
  ('33333333-3333-3333-3333-333333333333', 'lab-c', 'DB Test Lab C (unrelated)', 'laboratory', true, 'test', 'synthetic')
on conflict (id) do nothing;

insert into departments (id, tenant_id, name)
values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Microbiology')
on conflict (id) do nothing;

-- Existing profile with a password, home tenant NULL, used for existing-user + wrong-recipient tests
insert into profiles (id, email, full_name, role, tenant_id, password_hash, verification_status)
values ('55555555-5555-5555-5555-555555555555', 'existing-user@dbtest.invalid', 'Existing User', 'lab_tech', null, 'ORIGINAL_HASH_DO_NOT_CHANGE', 'verified')
on conflict (id) do nothing;

-- A different profile (the "wrong recipient") authenticated in another session
insert into profiles (id, email, full_name, role, tenant_id, verification_status)
values ('66666666-6666-6666-6666-666666666666', 'wrong-recipient@dbtest.invalid', 'Wrong Recipient', 'lab_tech', null, 'verified')
on conflict (id) do nothing;

-- Profile with an existing home tenant B assignment, used for multi-facility proof
insert into profiles (id, email, full_name, role, tenant_id, verification_status)
values ('77777777-7777-7777-7777-777777777777', 'multi-facility@dbtest.invalid', 'Multi Facility', 'lab_tech', '22222222-2222-2222-2222-222222222222', 'verified')
on conflict (id) do nothing;
insert into staff_scope_assignments (profile_id, tenant_id, role, is_active)
values ('77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 'lab_tech', true)
on conflict do nothing;

-- An unrelated profile scoped only to tenant C, used to prove RLS hides
-- other tenants' membership rows from a profile that has no relationship
-- to tenant C at all.
insert into profiles (id, email, full_name, role, tenant_id, verification_status)
values ('88888888-8888-8888-8888-888888888888', 'unrelated-tenant-c@dbtest.invalid', 'Unrelated', 'lab_tech', '33333333-3333-3333-3333-333333333333', 'verified')
on conflict (id) do nothing;
insert into staff_scope_assignments (profile_id, tenant_id, role, is_active)
values ('88888888-8888-8888-8888-888888888888', '33333333-3333-3333-3333-333333333333', 'lab_tech', true)
on conflict do nothing;

-- Invitations (token_hash values are sha256('test-token-N') precomputed below via psql digest)
insert into facility_invitations (id, tenant_id, email, full_name, role, token_hash, status, expires_at, department_id)
values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'new-account@dbtest.invalid', 'New Account', 'lab_tech', encode(digest('token-new-account','sha256'),'hex'), 'PENDING', now() + interval '7 days', '44444444-4444-4444-4444-444444444444'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'existing-user@dbtest.invalid', 'Existing User', 'lab_tech', encode(digest('token-existing-user','sha256'),'hex'), 'PENDING', now() + interval '7 days', null),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'wrong-recipient-target@dbtest.invalid', 'Target', 'lab_tech', encode(digest('token-wrong-recipient','sha256'),'hex'), 'PENDING', now() + interval '7 days', null),
  ('a0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'concurrent@dbtest.invalid', 'Concurrent', 'lab_tech', encode(digest('token-concurrent','sha256'),'hex'), 'PENDING', now() + interval '7 days', null),
  ('a0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'rollback@dbtest.invalid', 'Rollback', 'lab_tech', encode(digest('token-rollback','sha256'),'hex'), 'PENDING', now() + interval '7 days', null),
  ('a0000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'multi-facility@dbtest.invalid', 'Multi Facility', 'lab_scientist', encode(digest('token-multi-facility','sha256'),'hex'), 'PENDING', now() + interval '7 days', null)
on conflict (id) do nothing;

-- A synapse_sessions row + mfa_enrollments row are not required for these
-- acceptance-flow tests (MFA step-up is tested by the vitest unit suite),
-- so they are intentionally omitted here.

commit;
SQL
echo "Fixtures seeded."

# ---------------------------------------------------------------------------
# 1. SQL functions actually execute + persist department assignment
# ---------------------------------------------------------------------------
result=$($PSQL -tA -c "select accept_facility_invitation_new_account(encode(digest('token-new-account','sha256'),'hex'), 'b0000000-0000-0000-0000-000000000001', 'hashed:pw', 'New Account', 'New', 'Account');")
if echo "$result" | grep -q '"ok": true'; then
  pass "new-account RPC executes and returns ok"
else
  fail "new-account RPC executes and returns ok" "$result"
fi

dept=$($PSQL -tA -c "select department_id from staff_scope_assignments where profile_id = 'b0000000-0000-0000-0000-000000000001';")
if [ "$dept" = "44444444-4444-4444-4444-444444444444" ]; then
  pass "invited department persisted onto staff_scope_assignments"
else
  fail "invited department persisted onto staff_scope_assignments" "got '$dept'"
fi

verif=$($PSQL -tA -c "select coalesce(verification_status,'<null>') from profiles where id = 'b0000000-0000-0000-0000-000000000001';")
onboard=$($PSQL -tA -c "select onboarding_complete from profiles where id = 'b0000000-0000-0000-0000-000000000001';")
if [ "$verif" != "verified" ] && [ "$verif" != "approved" ] && [ "$onboard" = "f" ]; then
  pass "professional privileges not prematurely granted (verification_status='$verif', onboarding_complete=$onboard)"
else
  fail "professional privileges not prematurely granted" "verification_status='$verif' onboarding_complete=$onboard"
fi

# ---------------------------------------------------------------------------
# 2. Wrong recipient rejected
# ---------------------------------------------------------------------------
err=$(expect_error postgres "" "select accept_facility_invitation_existing_user(encode(digest('token-wrong-recipient','sha256'),'hex'), '66666666-6666-6666-6666-666666666666');")
if echo "$err" | grep -q 'WRONG_RECIPIENT'; then
  pass "wrong authenticated recipient is rejected"
else
  fail "wrong authenticated recipient is rejected" "$err"
fi
status=$($PSQL -tA -c "select status from facility_invitations where id = 'a0000000-0000-0000-0000-000000000003';")
if [ "$status" = "PENDING" ]; then
  pass "invitation remains PENDING after wrong-recipient rejection (retry-safe)"
else
  fail "invitation remains PENDING after wrong-recipient rejection" "status=$status"
fi

# ---------------------------------------------------------------------------
# 3. Existing password unchanged on existing-user acceptance
# ---------------------------------------------------------------------------
result=$($PSQL -tA -c "select accept_facility_invitation_existing_user(encode(digest('token-existing-user','sha256'),'hex'), '55555555-5555-5555-5555-555555555555');")
if echo "$result" | grep -q '"ok": true'; then
  pass "existing-user acceptance executes"
else
  fail "existing-user acceptance executes" "$result"
fi
pwhash=$($PSQL -tA -c "select password_hash from profiles where id = '55555555-5555-5555-5555-555555555555';")
if [ "$pwhash" = "ORIGINAL_HASH_DO_NOT_CHANGE" ]; then
  pass "existing password is unchanged by acceptance"
else
  fail "existing password is unchanged by acceptance" "password_hash=$pwhash"
fi

# ---------------------------------------------------------------------------
# 4. Multi-facility membership: accepting facility B does not remove facility A
# ---------------------------------------------------------------------------
result=$($PSQL -tA -c "select accept_facility_invitation_existing_user(encode(digest('token-multi-facility','sha256'),'hex'), '77777777-7777-7777-7777-777777777777');")
if echo "$result" | grep -q '"ok": true'; then
  pass "second-facility acceptance executes for a profile with an existing home tenant"
else
  fail "second-facility acceptance executes for a profile with an existing home tenant" "$result"
fi
scope_count=$($PSQL -tA -c "select count(*) from staff_scope_assignments where profile_id = '77777777-7777-7777-7777-777777777777' and is_active;")
tenants_held=$($PSQL -tA -c "select string_agg(tenant_id::text, ',' order by tenant_id) from staff_scope_assignments where profile_id = '77777777-7777-7777-7777-777777777777' and is_active;")
if [ "$scope_count" = "2" ]; then
  pass "multi-facility membership: profile now holds 2 active facility scopes ($tenants_held)"
else
  fail "multi-facility membership: profile now holds 2 active facility scopes" "count=$scope_count ($tenants_held)"
fi
home_tenant=$($PSQL -tA -c "select tenant_id from profiles where id = '77777777-7777-7777-7777-777777777777';")
if [ "$home_tenant" = "22222222-2222-2222-2222-222222222222" ]; then
  pass "home tenant (profiles.tenant_id) is not overwritten by the additional facility acceptance"
else
  fail "home tenant is not overwritten" "tenant_id=$home_tenant"
fi

# ---------------------------------------------------------------------------
# 5. Concurrent redemption of the same token has exactly one winner
# ---------------------------------------------------------------------------
for i in 1 2 3 4 5; do
  ( $PSQL -tA -c "select accept_facility_invitation_new_account(encode(digest('token-concurrent','sha256'),'hex'), gen_random_uuid(), 'hashed:pw', 'Concurrent', 'Concurrent', null);" > "$test_tmp/concurrent-result-$i.txt" 2>&1 || true ) &
done
wait
winners=$( (grep -l '"ok": true' "$test_tmp"/concurrent-result-*.txt || true) | wc -l | tr -d ' ')
losers=$( (grep -l 'INVITE_ALREADY_USED' "$test_tmp"/concurrent-result-*.txt || true) | wc -l | tr -d ' ')
if [ "$winners" = "1" ] && [ "$losers" = "4" ]; then
  pass "concurrent redemption of one token has exactly one winner (5 parallel attempts -> 1 win, 4 rejected)"
else
  fail "concurrent redemption of one token has exactly one winner" "winners=$winners losers=$losers"
fi
scope_rows=$($PSQL -tA -c "select count(*) from staff_scope_assignments where tenant_id = '11111111-1111-1111-1111-111111111111' and role = 'lab_tech' and profile_id in (select redeemed_by from facility_invitations where id = 'a0000000-0000-0000-0000-000000000004');")
if [ "$scope_rows" = "1" ]; then
  pass "concurrent redemption created exactly one membership row"
else
  fail "concurrent redemption created exactly one membership row" "scope_rows=$scope_rows"
fi

# ---------------------------------------------------------------------------
# 6/7. A genuine mid-transaction failure rolls back fully, and the same
# invitation can then be retried successfully.
# ---------------------------------------------------------------------------
# Force a profiles primary-key collision partway through the function (after
# the invitation row is locked, before staff_scope_assignments is written) by
# reusing an id that already exists in profiles. Capture the baseline first —
# an earlier test in this suite already legitimately grants profile
# 55555555... a tenant-A/lab_tech scope row, so the rollback proof is "no
# additional row appears", not "zero rows exist".
scope_rows_before=$($PSQL -tA -c "select count(*) from staff_scope_assignments where tenant_id='11111111-1111-1111-1111-111111111111' and profile_id='55555555-5555-5555-5555-555555555555' and role='lab_tech';")
err=$(expect_error postgres "" "select accept_facility_invitation_new_account(encode(digest('token-rollback','sha256'),'hex'), '55555555-5555-5555-5555-555555555555', 'hashed:pw', 'Rollback', 'Rollback', null);")
if echo "$err" | grep -qi 'duplicate key\|already exists'; then
  pass "profile-write failure aborts the acceptance transaction"
else
  fail "profile-write failure aborts the acceptance transaction" "$err"
fi
status=$($PSQL -tA -c "select status from facility_invitations where id = 'a0000000-0000-0000-0000-000000000005';")
scope_rows_after=$($PSQL -tA -c "select count(*) from staff_scope_assignments where tenant_id='11111111-1111-1111-1111-111111111111' and profile_id='55555555-5555-5555-5555-555555555555' and role='lab_tech';")
if [ "$status" = "PENDING" ] && [ "$scope_rows_after" = "$scope_rows_before" ]; then
  pass "failed acceptance leaves invitation PENDING and creates no additional membership row (full rollback)"
else
  fail "failed acceptance leaves invitation PENDING and creates no additional membership row" "status=$status scope_rows_before=$scope_rows_before scope_rows_after=$scope_rows_after"
fi
retry=$($PSQL -tA -c "select accept_facility_invitation_new_account(encode(digest('token-rollback','sha256'),'hex'), 'c0000000-0000-0000-0000-000000000001', 'hashed:pw', 'Rollback', 'Rollback', null);")
if echo "$retry" | grep -q '"ok": true'; then
  pass "the same invitation can be retried successfully after the earlier failure"
else
  fail "the same invitation can be retried successfully after the earlier failure" "$retry"
fi

# ---------------------------------------------------------------------------
# 8. anon/authenticated roles cannot directly execute the privileged RPCs
# ---------------------------------------------------------------------------
# Verify persisted grants here, then exercise actual denied calls below.
# The isolated PostgreSQL 16 runner avoids the previously documented
# Supabase PostgreSQL 17 image crash; grant inspection alone is insufficient.
anon_can_new=$($PSQL -tA -c "select has_function_privilege('anon', 'accept_facility_invitation_new_account(text,uuid,text,text,text,text)', 'EXECUTE');")
auth_can_existing=$($PSQL -tA -c "select has_function_privilege('authenticated', 'accept_facility_invitation_existing_user(text,uuid)', 'EXECUTE');")
service_can_new=$($PSQL -tA -c "select has_function_privilege('service_role', 'accept_facility_invitation_new_account(text,uuid,text,text,text,text)', 'EXECUTE');")
if [ "$anon_can_new" = "f" ] && [ "$auth_can_existing" = "f" ] && [ "$service_can_new" = "t" ]; then
  pass "anon/authenticated lack EXECUTE on the privileged RPCs; service_role retains it"
else
  fail "anon/authenticated lack EXECUTE on the privileged RPCs" "anon_can_new=$anon_can_new auth_can_existing=$auth_can_existing service_can_new=$service_can_new"
fi

# ---------------------------------------------------------------------------
# 9. Tenant isolation RLS holds for staff_scope_assignments
# ---------------------------------------------------------------------------
# Profile in tenant B (multi-facility profile) must not see the unrelated
# tenant-C-only profile's membership row, even with an unfiltered query.
real_total=$($PSQL -tA -c "select count(*) from staff_scope_assignments;")
visible_total=$(scalar authenticated "77777777-7777-7777-7777-777777777777" "select count(*) from staff_scope_assignments;")
foreign_visible=$(scalar authenticated "77777777-7777-7777-7777-777777777777" "select count(*) from staff_scope_assignments where profile_id = '88888888-8888-8888-8888-888888888888';")
if [ "$visible_total" -lt "$real_total" ] && [ "$foreign_visible" = "0" ]; then
  pass "RLS: profile sees fewer rows than the true total and zero rows for an unrelated tenant's profile (real=$real_total visible=$visible_total)"
else
  fail "RLS: tenant isolation on staff_scope_assignments" "real_total=$real_total visible_total=$visible_total foreign_visible=$foreign_visible"
fi

for role in anon authenticated; do
  for call in "accept_facility_invitation_existing_user('invalid', gen_random_uuid())" "accept_facility_invitation_new_account('invalid', gen_random_uuid(), 'hash', 'Name', 'Name', null)"; do
    err=$(expect_error "$role" "" "select $call;")
    if [[ "$err" == *"permission denied for function"* ]]; then
      pass "$role directly denied privileged RPC"
    else
      fail "$role directly denied privileged RPC" "$err"
    fi
  done
done

# Failure at the final audit write must roll back the profile, assignment,
# and consumed invitation, not merely fail before any writes took place.
$PSQL <<'SQL'
insert into facility_invitations (id, tenant_id, email, full_name, role, token_hash, status, expires_at)
values ('a0000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'audit-failure@dbtest.invalid', 'Audit Failure', 'lab_tech', 'audit-failure-token', 'PENDING', now() + interval '1 day');
create function test_reject_audit() returns trigger language plpgsql as $$
begin raise exception 'TEST_AUDIT_FAILURE'; end $$;
create trigger test_reject_audit before insert on facility_invitation_audit for each row execute function test_reject_audit();
SQL
err=$(expect_error postgres "" "select accept_facility_invitation_new_account('audit-failure-token', 'b0000000-0000-0000-0000-000000000007', 'hash', 'Audit', 'Audit', null);")
remaining=$($PSQL -tA -c "select count(*) from profiles where id='b0000000-0000-0000-0000-000000000007';")
status=$($PSQL -tA -c "select status from facility_invitations where id='a0000000-0000-0000-0000-000000000007';")
if [[ "$err" == *TEST_AUDIT_FAILURE* && "$remaining" == 0 && "$status" == PENDING ]]; then
  pass "final audit failure rolls back profile, membership and invitation acceptance"
else
  fail "final audit failure rollback" "$err rows=$remaining status=$status"
fi
$PSQL -c 'drop trigger test_reject_audit on facility_invitation_audit; drop function test_reject_audit();'
result=$($PSQL -tA -c "select accept_facility_invitation_new_account('audit-failure-token', 'b0000000-0000-0000-0000-000000000007', 'hash', 'Audit', 'Audit', null);")
if [[ "$result" == *'"ok": true'* ]]; then pass "retry after audit failure succeeds"; else fail "retry after audit failure" "$result"; fi

echo "=== SUMMARY: ${PASS} passed, ${FAIL} failed ==="
if [ ${FAIL} -gt 0 ]; then
  echo "Failed checks: ${FAILED_NAMES[*]}"
  exit 1
fi
exit 0
