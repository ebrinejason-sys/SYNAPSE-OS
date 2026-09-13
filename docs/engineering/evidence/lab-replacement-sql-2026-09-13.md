---
result: PASS
environment: disposable-docker-postgres-synapse-rc1-lab
sha: 090ae645d57c671b5c11f5913d015cc524bf4009
scope: lab-replacement-sql (migration 20260913010000 + 20260913020000)
recordedAt: 2026-09-13T08:40:00.000Z
---

# Lab replacement SQL — disposable acceptance

## Environment
- Throwaway Docker `public.ecr.aws/supabase/postgres:17.6.1.104` labeled `synapse.disposable-test=true`
- Bootstrap: `scripts/db-tests/curated-schema-bootstrap.sql` + `scripts/db-tests/lab-rc1-bootstrap.sql` (DDL cited from repo migrations)
- Applied verbatim: `20260913010000_lab_order_replacement_link.sql`, `20260913020000_lab_order_one_open_replacement.sql`

## Results
- Migration apply: PASS (`replaces_lab_order_id` + FK present)
- Happy-path replacement link: PASS
- Duplicate open replacement: PASS (unique index blocks)
- Cross-tenant replaces FK: NOTE — DB FK allows; API must deny via tenant-scoped prior lookup (implemented)
- Non-REJECTED parent: NOTE — DB allows; API returns 400 (implemented)

## Not claimed
- Browser journey
- Full migration-chain replay (`supabase start` still fails on historical `profiles` gap)
