#!/usr/bin/env bash
# Feature-contract tests on real PostgreSQL; not full migration-chain proof.
set -euo pipefail
cd "$(dirname "$0")/../.."
name="synapse-invitation-test-$$"
export PGHOST=127.0.0.1 PGUSER=postgres PGDATABASE=postgres
export PGPASSWORD="$(openssl rand -hex 24)"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --name "$name" --label synapse.disposable-test=true -d \
  -e POSTGRES_PASSWORD="$PGPASSWORD" -p 127.0.0.1::5432 postgres:16-alpine >/dev/null
export PGPORT="$(docker port "$name" 5432/tcp | awk -F: '{print $NF}')"
for attempt in {1..30}; do
  if pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >/dev/null; then break; fi
  sleep 1
done
psql -X -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
SQL
psql -X -q -v ON_ERROR_STOP=1 -f scripts/db-tests/curated-schema-bootstrap.sql
psql -X -q -v ON_ERROR_STOP=1 -c 'grant usage on schema public to anon, authenticated, service_role; grant select on public.staff_scope_assignments to authenticated;'
export SYNAPSE_DISPOSABLE_DB_TEST=true
bash scripts/db-tests/run-facility-invitation-db-tests.sh
